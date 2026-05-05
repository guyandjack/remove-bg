import Replicate from "replicate";
import axios, { type AxiosError } from "axios";

import type { RequestHandler } from "express";
import type { ValidatedImage } from "../../middelware/checkDataUpload/checkDataUpload.js";
import { logger } from "../../logger.js";
import {
  getActiveUsageBillingPeriod,
  getUserByEmail,
  recordCreditUsage,
} from "../../DB/queriesSQL/queriesSQL.js";

const REPLICATE_TIMEOUT_MS =
  Number(process.env.REPLICATE_TIMEOUT_MS ?? "120000") || 120000;

/**
 * Replicate - modÃ¨les (version pin) pour le dÃ©tourage.
 * NB: on ne supprime pas l'ancien contrÃ´leur removeBg (hÃ©bergement interne).
 */
const modelType = {
  portrait:
    "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc",
  classic:
    "lucataco/remove-bg:95fcd71f498c39733470725a3d077461947345e69e46a7826ed1052675b7501e",
} as const;
type ReplicateModelKey = keyof typeof modelType;

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

function maskEmail(email: string): string {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  if (at <= 0) return value ? "***" : "";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const safeLocal =
    local.length <= 2 ? `${local[0] ?? "*"}*` : `${local.slice(0, 2)}***`;
  const safeDomain =
    domain.length <= 3
      ? `${domain[0] ?? "*"}**`
      : `${domain[0]}***${domain.slice(-2)}`;
  return `${safeLocal}@${safeDomain}`;
}

function extensionFromContentType(contentType: string): "png" | "jpg" | "webp" {
  const normalized = (contentType || "").toLowerCase().split(";")[0]?.trim();
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  return "png";
}

function normalizeModelKey(candidate: unknown): ReplicateModelKey | null {
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim().toLowerCase();
  if (normalized === "portrait") return "portrait";
  if (normalized === "classic") return "classic";
  return null;
}

function pickModelKey(req: any): ReplicateModelKey {
  const fromUser =
    normalizeModelKey(req.query?.model) ?? normalizeModelKey(req.body?.model);
  if (fromUser) return fromUser;

  const quality = (req as any).removeBgOptions?.quality;
  return quality === "fast" ? "classic" : "portrait";
}

async function outputToBinary(
  output: unknown
): Promise<{ buffer: Buffer; contentType: string }> {
  // Certains appels peuvent renvoyer l'output directement, ou dans un objet { output }.
  const actualOutput = (output as any)?.output ?? output;

  // La lib peut renvoyer des FileOutput (ReadableStream) ou des URLs si useFileOutput=false.
  const first =
    Array.isArray(actualOutput) && actualOutput.length > 0
      ? actualOutput[0]
      : actualOutput;

  // FileOutput (ReadableStream) -> blob -> Buffer
  if (first && typeof (first as any).blob === "function") {
    const blob = await (first as any).blob();
    const arrayBuffer = await blob.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: blob?.type || "image/png",
    };
  }

  // URL -> download
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

  throw new Error("Format de sortie Replicate non supportÃ©.");
}

const removeBgByReplicate: RequestHandler = async (req, res) => {
  const requestId = (req as any).requestId;
  const requestMeta = {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
  };

  try {
    const { email } =
      ((req as any).payload as { email?: string } | undefined) || {};
    if (!email) {
      logger.warn("removeBgByReplicate::unauthorized_missing_payload", requestMeta);
      return res.status(401).json({
        error: true,
        message: "Unauthorized: missing user payload",
        requestId,
      });
    }

    const replicateToken =
      process.env.REPLICATE_API_TOKEN ?? process.env.REPLICATE_API_KEY_WIZPIX;
    if (!replicateToken) {
      logger.error("removeBgByReplicate::missing_replicate_token", requestMeta);
      return res.status(500).json({
        error: true,
        message:
          "Configuration manquante: REPLICATE_API_TOKEN (ou REPLICATE_API_KEY_WIZPIX).",
        requestId,
      });
    }

    const image = (req as any).imageValidated as ValidatedImage | undefined;
    if (!image) {
      logger.warn("removeBgByReplicate::missing_validated_image", requestMeta);
      return res.status(400).json({
        error: true,
        message: "Aucune image valide n'a ete detectee.",
        requestId,
      });
    }

    const modelKey = pickModelKey(req);
    const modelIdentifier = modelType[modelKey];

    // Credits check (monthly billing period)
    const user = await getUserByEmail(String(email).toLowerCase());
    if (!user) {
      logger.warn("removeBgByReplicate::user_not_found", {
        ...requestMeta,
        email: maskEmail(String(email)),
      });
      return res.status(404).json({
        error: true,
        message: "User not found",
        requestId,
      });
    }
    const usage = await getActiveUsageBillingPeriod(user.id);
    if (!usage) {
      logger.warn("removeBgByReplicate::no_active_plan", {
        ...requestMeta,
        userId: user.id,
      });
      return res.status(403).json({
        error: true,
        message: "No active subscription or plan",
        requestId,
      });
    }
    if (usage.remaining_in_period <= 0) {
      logger.info("removeBgByReplicate::no_credits", {
        ...requestMeta,
        userId: user.id,
        subscriptionId: usage.subscription_id,
        remaining: usage.remaining_in_period,
      });
      return res.status(429).json({
        error: true,
        message: "No more credits available for this billing period",
        requestId,
        credits: {
          used_last_24h: usage.used_in_period,
          remaining_last_24h: usage.remaining_in_period,
        },
      });
    }

    // Replicate impose `Prefer: wait=x` avec `x` entre 1 et 60 (secondes).
    // La lib JS mappe `wait.timeout` -> header (en *secondes*), donc on borne ici.
    const preferWaitSeconds = Math.min(
      60,
      Math.max(1, Math.ceil(REPLICATE_TIMEOUT_MS / 1000))
    );

    // Replicate (API): input/output/logs supprimÃ©s automatiquement aprÃ¨s ~1h par dÃ©faut.
    // Il n'existe pas d'option API pour forcer une suppression immÃ©diate.
    // CÃ´tÃ© serveur: on ne persiste rien et on renvoie le rÃ©sultat immÃ©diatement au client.
    const replicate = new Replicate({
      auth: replicateToken,
      useFileOutput: true,
    });

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      REPLICATE_TIMEOUT_MS
    );

    try {
      const startedAt = Date.now();
      logger.info("removeBgByReplicate::call_start", {
        requestId,
        modelKey,
        modelIdentifier,
        size: image.size,
        mime: image.mime,
        userId: user.id,
      });

      const output = await replicate.run(modelIdentifier, {
        input: {
          // La lib gÃ¨re l'upload du Buffer (max 100MB selon la doc Replicate).
          image: image.buffer,
        },
        // IMPORTANT: `timeout` ici est en secondes (pas ms).
        wait: { mode: "block", timeout: preferWaitSeconds },
        signal: abortController.signal,
      });

      const { buffer, contentType } = await outputToBinary(output);
      const filename = sanitizeFilename(image.originalName);
      const extension = extensionFromContentType(contentType);

      res.setHeader("Content-Type", contentType || "image/png");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}-bg-removed.${extension}"`
      );

      logger.info("removeBgByReplicate::call_success", {
        requestId,
        durationMs: Date.now() - startedAt,
        modelKey,
        outputBytes: buffer.length,
        userId: user.id,
      });

      // Decrement credits only on successful Replicate output.
      // For a robust MVP, if we can't persist usage, we fail the request: otherwise
      // you'd be delivering paid output without accounting.
      const recordedId = await recordCreditUsage(
        usage.subscription_id,
        1,
        "replicate_remove_bg",
        requestId
      );
      if (!recordedId) {
        throw new Error("Credit usage insert returned null");
      }
      logger.info("removeBgByReplicate::credit_decrement_success", {
        requestId,
        subscriptionId: usage.subscription_id,
        usageId: recordedId,
        userId: user.id,
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
        logger.warn("removeBgByReplicate::credits_header_failed", {
          requestId,
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

      logger.error("removeBgByReplicate::call_failed", {
        requestId,
        isAbort,
        message: err?.message ?? String(err),
        status: upstreamStatus,
        modelKey,
        userId: user.id,
      });

      const status = isAbort ? 504 : upstreamStatus ?? 502;
      return res.status(status).json({
        error: true,
        message:
          isAbort
            ? "Timeout: Replicate n'a pas rÃ©pondu Ã  temps."
            : status >= 500
              ? "Le service Replicate est indisponible pour le moment."
              : err?.message ?? "Erreur Replicate",
        requestId,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (unhandledErr: any) {
    logger.error("removeBgByReplicate::unhandled_error", {
      ...requestMeta,
      message: unhandledErr?.message ?? String(unhandledErr),
      stack: unhandledErr?.stack,
    });
    return res.status(500).json({
      error: true,
      message: "Erreur interne du serveur.",
      requestId,
    });
  }
};

export { removeBgByReplicate };
