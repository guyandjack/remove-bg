import Replicate from "replicate";
import axios, { type AxiosError } from "axios";
import sharp from "sharp";

import type { RequestHandler } from "express";
import { logger } from "../../logger.js";

import type { ValidatedImage } from "../../middelware/checkDataUpload/checkDataUpload.js";
import {
  getActiveUsageBillingPeriod,
  getUserByEmail,
  recordCreditUsage,
} from "../../DB/queriesSQL/queriesSQL.js";

const REPLICATE_TIMEOUT_MS =
  Number(process.env.REPLICATE_TIMEOUT_MS ?? "120000") || 120000;

// Replicate model (pinned version) - flamel eraser (inpainting with mask)
const MODEL_IDENTIFIER =
  "smoretalk/flamel-eraser:826441c948a5792375c071be1dcd02e018592595ae9aa7ca756bf8e04c1bffc1";

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "image"
  );
}

function extensionFromContentType(contentType: string): "png" | "jpg" | "webp" {
  const normalized = (contentType || "").toLowerCase().split(";")[0]?.trim();
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  return "png";
}

async function outputToBinary(
  output: unknown
): Promise<{ buffer: Buffer; contentType: string }> {
  const actualOutput = (output as any)?.output ?? output;
  const first =
    Array.isArray(actualOutput) && actualOutput.length > 0
      ? actualOutput[0]
      : actualOutput;

  if (first && typeof (first as any).blob === "function") {
    const blob = await (first as any).blob();
    const arrayBuffer = await blob.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: blob?.type || "image/png",
    };
  }

  if (typeof first === "string" && /^https?:\/\//i.test(first)) {
    const response = await axios.get<ArrayBuffer>(first, {
      responseType: "arraybuffer",
      timeout: REPLICATE_TIMEOUT_MS,
    });
    return {
      buffer: Buffer.from(response.data),
      contentType: String(response.headers?.["content-type"] || "image/png"),
    };
  }

  throw new Error("Format de sortie Replicate non supporte.");
}

async function normalizeMaskToImageSize(
  maskBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  // Le front dessine un masque semi-transparent (RGBA) : on convertit en masque binaire
  // basé sur l'alpha, puis on resize exactement à la taille de l'image.
  const alpha = await sharp(maskBuffer)
    .ensureAlpha()
    .resize(width, height, { fit: "fill" })
    .extractChannel(3) // alpha
    .threshold(1) // tout pixel avec alpha>0 => blanc
    .toColourspace("b-w")
    .png()
    .toBuffer();

  return alpha;
}

function pickNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const magicEraser: RequestHandler = async (req, res) => {
  const { email } = (req as any).payload as { email?: string } | undefined || {};
  if (!email) {
    return res.status(401).json({
      error: true,
      message: "Unauthorized: missing user payload",
      requestId: (req as any).requestId,
    });
  }

  const replicateToken =
    process.env.REPLICATE_API_TOKEN ?? process.env.REPLICATE_API_KEY_WIZPIX;
  if (!replicateToken) {
    return res.status(500).json({
      error: true,
      message:
        "Configuration manquante: REPLICATE_API_TOKEN (ou REPLICATE_API_KEY_WIZPIX).",
      requestId: (req as any).requestId,
    });
  }

  const initImage = (req as any).magicEraserInitImage as
    | ValidatedImage
    | undefined;
  const maskImage = (req as any).magicEraserMaskImage as
    | ValidatedImage
    | undefined;

  if (!initImage || !maskImage) {
    return res.status(400).json({
      error: true,
      message: "Image ou masque manquant/invalide.",
      requestId: (req as any).requestId,
    });
  }

  // Replicate impose `Prefer: wait=x` entre 1 et 60 (secondes)
  const preferWaitSeconds = Math.min(
    60,
    Math.max(1, Math.ceil(REPLICATE_TIMEOUT_MS / 1000))
  );

  // Doc flamel-eraser: init_image, mask_image, prompt, num_inference_steps, num_images_per_prompt,
  // guidance_scale, controlnet_scale
  const prompt =
    (typeof req.body?.prompt === "string" ? req.body.prompt : "") ||
    (typeof req.query?.prompt === "string" ? req.query.prompt : "") ||
    "remove object";

  const numInferenceSteps = pickNumber(
    req.body?.num_inference_steps ?? req.query?.num_inference_steps,
    8,
    1,
    50
  );

  const numImagesPerPrompt = pickNumber(
    req.body?.num_images_per_prompt ?? req.query?.num_images_per_prompt,
    1,
    1,
    4
  );

  const guidanceScale = pickNumber(
    req.body?.guidance_scale ?? req.query?.guidance_scale,
    1.5,
    0,
    20
  );

  const controlnetScale = pickNumber(
    req.body?.controlnet_scale ?? req.query?.controlnet_scale,
    1,
    0,
    1
  );

  // Credits check (monthly billing period)
  const user = await getUserByEmail(String(email).toLowerCase());
  if (!user) {
    return res.status(404).json({
      error: true,
      message: "User not found",
      requestId: (req as any).requestId,
    });
  }
  const usage = await getActiveUsageBillingPeriod(user.id);
  if (!usage) {
    return res.status(403).json({
      error: true,
      message: "No active subscription or plan",
      requestId: (req as any).requestId,
    });
  }
  if (usage.remaining_in_period <= 0) {
    return res.status(429).json({
      error: true,
      message: "No more credits available for this billing period",
      requestId: (req as any).requestId,
      credits: {
        used_last_24h: usage.used_in_period,
        remaining_last_24h: usage.remaining_in_period,
      },
    });
  }

  const replicate = new Replicate({
    auth: replicateToken,
    useFileOutput: true,
  });

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REPLICATE_TIMEOUT_MS);

  try {
    const startedAt = Date.now();
    logger.info("magicEraser::call_start", {
      requestId: (req as any).requestId,
      modelIdentifier: MODEL_IDENTIFIER,
      initSize: initImage.size,
      initMime: initImage.mime,
      maskSize: maskImage.size,
      maskMime: maskImage.mime,
      numInferenceSteps,
      numImagesPerPrompt,
    });

    const initMeta = await sharp(initImage.buffer).metadata();
    const width = initMeta.width;
    const height = initMeta.height;
    if (!width || !height) {
      return res.status(400).json({
        error: true,
        message: "Impossible de lire les dimensions de l'image source.",
        requestId: (req as any).requestId,
      });
    }

    const normalizedMask = await normalizeMaskToImageSize(
      maskImage.buffer,
      width,
      height
    );
    const normalizedMaskMeta = await sharp(normalizedMask).metadata();

    logger.info("magicEraser::normalized_inputs", {
      requestId: (req as any).requestId,
      sourceChannels: initMeta.channels,
      normalizedMaskChannels: normalizedMaskMeta.channels,
      width,
      height,
    });

    const output = await replicate.run(MODEL_IDENTIFIER, {
      input: {
        init_image: initImage.buffer,
        mask_image: normalizedMask,
        prompt,
        num_inference_steps: numInferenceSteps,
        num_images_per_prompt: numImagesPerPrompt,
        guidance_scale: guidanceScale,
        controlnet_scale: controlnetScale,
      },
      wait: { mode: "block", timeout: preferWaitSeconds },
      signal: abortController.signal,
    });

    const { buffer, contentType } = await outputToBinary(output);
    const filename = sanitizeFilename(initImage.originalName);
    const extension = extensionFromContentType(contentType);

    res.setHeader("Content-Type", contentType || "image/png");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename}-magic-eraser.${extension}"`
    );

    logger.info("magicEraser::call_success", {
      requestId: (req as any).requestId,
      durationMs: Date.now() - startedAt,
      outputBytes: buffer.length,
    });

    // Decrement credits only on successful Replicate output.
    // For a robust MVP, if we can't persist usage, we fail the request: otherwise
    // you'd be delivering paid output without accounting.
    const recordedId = await recordCreditUsage(
      usage.subscription_id,
      1,
      "replicate_magic_eraser",
      (req as any).requestId
    );
    if (!recordedId) {
      throw new Error("Credit usage insert returned null");
    }
    logger.info("magicEraser::credit_decrement_success", {
      requestId: (req as any).requestId,
      subscriptionId: usage.subscription_id,
      usageId: recordedId,
    });

    // Expose updated credits to the frontend (binary response)
    try {
      const refreshed = await getActiveUsageBillingPeriod(user.id);
      if (refreshed) {
        res.setHeader(
          "Access-Control-Expose-Headers",
          "X-Wizpix-Credits-Remaining,X-Wizpix-Credits-Used"
        );
        res.setHeader(
          "X-Wizpix-Credits-Remaining",
          String(refreshed.remaining_in_period)
        );
        res.setHeader("X-Wizpix-Credits-Used", String(refreshed.used_in_period));
      }
    } catch (headerErr: any) {
      logger.warn("magicEraser::credits_header_failed", {
        requestId: (req as any).requestId,
        message: headerErr?.message ?? String(headerErr),
      });
    }

    return res.status(200).send(buffer);
  } catch (error) {
    const err = error as any;
    const axiosError = error as AxiosError;
    const isAbort =
      abortController.signal.aborted ||
      err?.name === "AbortError" ||
      err?.code === "ABORT_ERR" ||
      false;

    const upstreamStatus: number | undefined =
      typeof err?.response?.status === "number"
        ? err.response.status
        : typeof (axiosError as any)?.response?.status === "number"
          ? (axiosError as any).response.status
          : undefined;

    logger.error("magicEraser::call_failed", {
      requestId: (req as any).requestId,
      isAbort,
      message: err?.message ?? String(err),
      status: upstreamStatus,
    });

    const status = isAbort ? 504 : upstreamStatus ?? 502;
    return res.status(status).json({
      error: true,
      message:
        isAbort
          ? "Timeout: Replicate n'a pas repondu a temps."
          : status >= 500
            ? "Le service Replicate est indisponible pour le moment."
            : err?.message ?? "Erreur Replicate",
      requestId: (req as any).requestId,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export { magicEraser };
