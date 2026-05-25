import type { NextFunction, Request, Response } from "express";
import sharp from "sharp";

import type { ValidatedImage } from "../checkDataUpload/checkDataUpload.js";
import { logger } from "../../logger.js";
import {
  getActivePlanCodeForUser,
  getUserByEmail,
} from "../../DB/queriesSQL/queriesSQL.js";
import {
  pickRemoveBgInputMaxWidth,
} from "../../services/removeBg/removeBgInputMaxWidth.js";

function getClientRequestId(req: Request): string | null {
  const fromBody =
    ((req as any).body?.requestId as string | undefined) ??
    ((req as any).body?.request_id as string | undefined);
  const value = String(fromBody ?? "").trim();
  return value ? value : null;
}

function normalizeNonEmptyString(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;
  const v = candidate.trim();
  return v ? v : null;
}

function normalizePlanCode(candidate: unknown): string | null {
  const v = normalizeNonEmptyString(candidate);
  return v ? v.toLowerCase() : null;
}

function effectiveWidth(meta: sharp.Metadata): number | null {
  const w = typeof meta.width === "number" ? meta.width : null;
  const h = typeof meta.height === "number" ? meta.height : null;
  const o = typeof meta.orientation === "number" ? meta.orientation : null;
  if (!w || !h) return null;
  // EXIF orientations that swap width/height (90/270 rotations).
  const swaps = o === 5 || o === 6 || o === 7 || o === 8;
  return swaps ? h : w;
}

async function resizeBuffer(params: {
  image: ValidatedImage;
  maxWidth: number;
}): Promise<ValidatedImage> {
  const { image, maxWidth } = params;

  const pipeline = sharp(image.buffer, { failOnError: false }).rotate().resize({
    width: maxWidth,
    withoutEnlargement: true,
  });

  // Preserve ICC profile when present (helps keep colours consistent).
  pipeline.withMetadata();

  let out: Buffer;
  if (image.mime === "image/jpeg") {
    // Speed + good visual fidelity for photos.
    // Note: `mozjpeg` is slower; keep defaults fast.
    out = await pipeline
      .jpeg({
        quality: 90,
        progressive: false,
        chromaSubsampling: "4:2:0",
      })
      .toBuffer();
  } else if (image.mime === "image/webp") {
    out = await pipeline
      .webp({
        quality: 90,
        effort: 3, // 0-6 (higher is slower/smaller)
      })
      .toBuffer();
  } else {
    // PNG input: keep PNG (may still be heavy, but resizing reduces pixel count).
    out = await pipeline
      .png({
        compressionLevel: 6, // sharp default (balanced)
        adaptiveFiltering: false, // faster
        palette: false, // faster (no quantization)
      })
      .toBuffer();
  }

  return {
    ...image,
    buffer: out,
    size: out.length,
  };
}

async function resolveUserPlanCodeFromRequest(req: Request): Promise<string | null> {
  const cached = normalizePlanCode((req as any).activePlanCode);
  if (cached) return cached;

  const email = normalizeNonEmptyString((req as any)?.payload?.email);
  if (!email) return null;

  try {
    const user = await getUserByEmail(email);
    if (!user) return null;
    const planCode = await getActivePlanCodeForUser(user.id);
    const normalized = normalizePlanCode(planCode);
    if (normalized) (req as any).activePlanCode = normalized;
    return normalized;
  } catch {
    return null;
  }
}

async function resolveMaxWidthForRequest(
  req: Request,
  opt?: number | ((req: Request) => number | Promise<number>),
): Promise<number> {
  try {
    if (typeof opt === "number" && Number.isFinite(opt) && opt > 0) {
      return Math.floor(opt);
    }
    if (typeof opt === "function") {
      const resolved = await opt(req);
      if (typeof resolved === "number" && Number.isFinite(resolved) && resolved > 0) {
        return Math.floor(resolved);
      }
    }
  } catch {}

  const isAuthenticated = Boolean(normalizeNonEmptyString((req as any)?.payload?.email));
  const planCode = isAuthenticated ? await resolveUserPlanCodeFromRequest(req) : null;
  return pickRemoveBgInputMaxWidth({ isAuthenticated, planCode });
}

/**
 * Limits the width of an uploaded image (pre-Replicate) to reduce:
 * - Replicate compute time
 * - Replicate output size (PNG with alpha can explode in weight)
 * - downstream sharp optimization time
 *
 * Guarantees:
 * - preserves proportions (no cropping)
 * - applies EXIF rotation (`rotate()`)
 * - tries to preserve colour profile (`withMetadata()`)
 */
export function limitRemoveBgInputMaxWidth(
  options: { maxWidth?: number | ((req: Request) => number | Promise<number>) } = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId;
    const clientRequestId = getClientRequestId(req);
    const image = (req as any).imageValidated as ValidatedImage | undefined;
    if (!image || !Buffer.isBuffer(image.buffer) || image.buffer.length === 0) {
      return next();
    }

    try {
      const maxWidth = await resolveMaxWidthForRequest(req, options.maxWidth);
      const totalStartedAt = Date.now();
      const metaStartedAt = Date.now();
      const meta = await sharp(image.buffer, { failOnError: false }).metadata();
      const metaMs = Date.now() - metaStartedAt;
      const w = effectiveWidth(meta);
      if (!w || w <= maxWidth) {
        // Keep logs low-noise by default (most images may already be small).
        // Enable with REMOVEBG_LOG_INPUT_RESIZE_SKIP=true.
        const logSkip =
          String(process.env.REMOVEBG_LOG_INPUT_RESIZE_SKIP ?? "false")
            .trim()
            .toLowerCase() === "true";
        if (logSkip) {
          logger.info("limitRemoveBgInputMaxWidth::skip", {
            requestId,
            clientRequestId,
            mime: image.mime,
            width: meta.width ?? null,
            height: meta.height ?? null,
            orientation: meta.orientation ?? null,
            effectiveWidth: w,
            maxWidth,
            bytes: image.size,
            metaMs,
            totalMs: Date.now() - totalStartedAt,
          });
        }
        return next();
      }

      const resizeStartedAt = Date.now();
      const resized = await resizeBuffer({ image, maxWidth });
      (req as any).imageValidated = resized;
      const resizeMs = Date.now() - resizeStartedAt;

      // Ensure downstream code sees the correct extension if the input used the jpg alias.
      // `ValidatedImage.extension` is only used for filenames; mime remains the source of truth.
      if (resized.mime === "image/jpeg") {
        resized.extension = "jpg";
      }

      // Helpful client hint (optional): tells front-end the input was resized server-side.
      // Only set when we actually resized.
      // Be careful to not clobber existing Access-Control-Expose-Headers set by other middleware/controllers.
      try {
        res.setHeader("X-Wizpix-Input-Resized", "1");
        res.setHeader("X-Wizpix-Input-Max-Width", String(maxWidth));
        const current = String(res.getHeader("Access-Control-Expose-Headers") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const wanted = ["X-Wizpix-Input-Resized", "X-Wizpix-Input-Max-Width"];
        const merged = Array.from(new Set([...current, ...wanted]));
        if (merged.length > 0) {
          res.setHeader("Access-Control-Expose-Headers", merged.join(","));
        }
      } catch {}

      logger.info("limitRemoveBgInputMaxWidth::resized", {
        requestId,
        clientRequestId,
        mime: image.mime,
        width: meta.width ?? null,
        height: meta.height ?? null,
        orientation: meta.orientation ?? null,
        effectiveWidth: w,
        maxWidth,
        bytesBefore: image.size,
        bytesAfter: resized.size,
        metaMs,
        resizeMs,
        totalMs: Date.now() - totalStartedAt,
      });

      return next();
    } catch (err: any) {
      // Don't fail the request if resizing fails; fall back to original.
      logger.warn("limitRemoveBgInputMaxWidth::failed", {
        code: "mw_resizeImageMaxWidth_err1",
        requestId,
        clientRequestId,
        message: err?.message ?? String(err),
      });
      return next();
    }
  };
}
