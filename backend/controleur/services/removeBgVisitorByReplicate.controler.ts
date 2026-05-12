import Replicate from "replicate";
import axios, { type AxiosError } from "axios";
import type { RequestHandler } from "express";

import type { ValidatedImage } from "../../middelware/checkDataUpload/checkDataUpload.js";
import { logger } from "../../logger.js";
import { getHashedVisitorIp } from "../../utils/visitorIpHash.js";
import { optimizeTransparentRaster } from "../../utils/images/optimizeTransparentRaster.js";
import { tryConsumeRemoveBgTrial } from "../../DB/queriesSQL/visitorQuota.queries.js";

const REPLICATE_TIMEOUT_MS =
  Number(process.env.REPLICATE_TIMEOUT_MS ?? "120000") || 120000;

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

const removeBgVisitorByReplicate: RequestHandler = async (req, res) => {
  const requestId = (req as any).requestId;
  const requestMeta = {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
  };

  try {
    const replicateToken =
      process.env.REPLICATE_API_TOKEN ?? process.env.REPLICATE_API_KEY_WIZPIX;
    if (!replicateToken) {
      logger.error("removeBgVisitorByReplicate::missing_replicate_token", requestMeta);
      return res.status(500).json({
        error: true,
        code: "CONFIG_MISSING",
        message:
          "Configuration manquante: REPLICATE_API_TOKEN (ou REPLICATE_API_KEY_WIZPIX).",
        requestId,
      });
    }

    const image = (req as any).imageValidated as ValidatedImage | undefined;
    if (!image) {
      logger.warn("removeBgVisitorByReplicate::missing_validated_image", requestMeta);
      return res.status(400).json({
        error: true,
        code: "INVALID_IMAGE",
        message: "Aucune image valide n'a ete detectee.",
        requestId,
      });
    }

    const { hashedIp, hashSuffix } = getHashedVisitorIp(req);
    const snapshot = await tryConsumeRemoveBgTrial(hashedIp);
    if (!snapshot.allowed) {
      logger.info("removeBgVisitorByReplicate::quota_blocked", {
        ...requestMeta,
        visitorHashSuffix: hashSuffix,
        used: snapshot.used,
        limit: snapshot.limit,
      });
      return res.status(429).json({
        error: true,
        code: "VISITOR_QUOTA_EXCEEDED",
        message:
          `Quota visiteur depasse: ${snapshot.limit} suppression d'arriere-plan maximum par mois.`,
        requestId,
        quota: { service: "remove_bg", used: snapshot.used, limit: snapshot.limit },
      });
    }

    const modelKey = pickModelKey(req);
    const modelIdentifier = modelType[modelKey];

    const preferWaitSeconds = Math.min(
      60,
      Math.max(1, Math.ceil(REPLICATE_TIMEOUT_MS / 1000)),
    );

    const replicate = new Replicate({
      auth: replicateToken,
      useFileOutput: true,
    });

    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      REPLICATE_TIMEOUT_MS,
    );

    try {
      const startedAt = Date.now();
      logger.info("removeBgVisitorByReplicate::call_start", {
        requestId,
        modelKey,
        size: image.size,
        mime: image.mime,
        visitorHashSuffix: hashSuffix,
      });

      const output = await replicate.run(modelIdentifier, {
        input: { image: image.buffer },
        wait: { mode: "block", timeout: preferWaitSeconds },
        signal: abortController.signal,
      });

      const { buffer: rawBuffer, contentType: rawContentType } = await outputToBinary(output);
      const optimized = await optimizeTransparentRaster({
        input: rawBuffer,
        inputContentType: rawContentType,
      });
      const filename = sanitizeFilename(image.originalName);
      const extension = optimized.extension;

      res.setHeader("Content-Type", optimized.contentType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename=\"${filename}-bg-removed.${extension}\"`,
      );
      // Indique explicitement la taille pour aider certains proxies/navigateurs.
      res.setHeader("Content-Length", String(optimized.buffer.length));
      // Cette réponse est un artefact dérivé d'un upload utilisateur: pas de cache.
      res.setHeader("Cache-Control", "no-store");
      res.setHeader(
        "Access-Control-Expose-Headers",
        "X-Wizpix-Visitor-Quota-Service,X-Wizpix-Visitor-Quota-Used,X-Wizpix-Visitor-Quota-Limit",
      );
      res.setHeader("X-Wizpix-Visitor-Quota-Service", "remove_bg");
      res.setHeader("X-Wizpix-Visitor-Quota-Used", String(snapshot.used));
      res.setHeader("X-Wizpix-Visitor-Quota-Limit", String(snapshot.limit));

      logger.info("removeBgVisitorByReplicate::call_success", {
        requestId,
        durationMs: Date.now() - startedAt,
        modelKey,
        outputBytes: optimized.buffer.length,
        outputBytesRaw: rawBuffer.length,
        visitorHashSuffix: hashSuffix,
      });

      // Debug: détecte les déconnexions client pendant l'envoi (souvent vu comme ERR_NETWORK côté Axios).
      const sendStartedAt = Date.now();
      res.on("close", () => {
        if (!res.writableEnded) {
          logger.warn("removeBgVisitorByReplicate::client_disconnected", {
            requestId,
            durationMs: Date.now() - sendStartedAt,
            bytesPlanned: optimized.buffer.length,
            visitorHashSuffix: hashSuffix,
          });
        }
      });

      return res.status(200).send(optimized.buffer);
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

      logger.error("removeBgVisitorByReplicate::call_failed", {
        requestId,
        isAbort,
        message: err?.message ?? String(err),
        status: upstreamStatus,
      });

      const status = isAbort ? 504 : upstreamStatus ?? 502;
      return res.status(status).json({
        error: true,
        code: isAbort ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
        message:
          isAbort
            ? "Timeout: le service de traitement n'a pas repondu a temps."
            : status >= 500
              ? "Le service de suppression de fond est indisponible pour le moment."
              : err?.message ?? "Erreur service",
        requestId,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (unhandledErr: any) {
    logger.error("removeBgVisitorByReplicate::unhandled_error", {
      ...requestMeta,
      message: unhandledErr?.message ?? String(unhandledErr),
      stack: unhandledErr?.stack,
    });
    return res.status(500).json({
      error: true,
      code: "INTERNAL_ERROR",
      message: "Erreur interne du serveur.",
      requestId,
    });
  }
};

export { removeBgVisitorByReplicate };
