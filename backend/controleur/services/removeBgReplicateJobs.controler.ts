import crypto from "node:crypto";
import Replicate from "replicate";

import type { RequestHandler } from "express";
import type { ValidatedImage } from "../../middelware/checkDataUpload/checkDataUpload.js";
import { logger } from "../../logger.js";
import { getPublicBackendBaseUrl } from "../../utils/publicBackendUrl.js";
import {
  createRemoveBgJobIdempotent,
  getRemoveBgJobByUserIdAndIdempotencyKey,
  setRemoveBgJobRunning,
  getUserByEmail,
} from "../../DB/queriesSQL/queriesSQL.js";
import { publishRemoveBgJobUpdatedPayload } from "../../services/removeBgJobs/removeBgJobEvents.js";

const modelType = {
  portrait:
    "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc",
  classic:
    "lucataco/remove-bg:95fcd71f498c39733470725a3d077461947345e69e46a7826ed1052675b7501e",
} as const;
type ReplicateModelKey = keyof typeof modelType;

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

function extractVersionFromIdentifier(identifier: string): string {
  const value = String(identifier || "").trim();
  const parts = value.split(":");
  const version = parts.length >= 2 ? parts[1]?.trim() : "";
  if (!version) {
    throw new Error("Invalid Replicate model identifier: missing version");
  }
  return version;
}

function getIdempotencyKey(req: any): string | null {
  const fromHeader =
    (req.headers?.["idempotency-key"] as string | undefined) ??
    (req.headers?.["x-idempotency-key"] as string | undefined);
  const fromBody =
    (req.body?.idempotencyKey as string | undefined) ??
    (req.body?.idempotency_key as string | undefined);
  const value = String(fromHeader ?? fromBody ?? "").trim();
  return value ? value : null;
}

function getRequestIdFromClient(req: any): string | null {
  const fromBody =
    (req.body?.requestId as string | undefined) ??
    (req.body?.request_id as string | undefined);
  const value = String(fromBody ?? "").trim();
  return value ? value : null;
}

export const createRemoveBgReplicateJob: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const requestMeta = {
    requestId: httpRequestId,
    method: req.method,
    path: req.originalUrl || req.url,
  };

  try {
    const { email } =
      ((req as any).payload as { email?: string } | undefined) || {};
    if (!email) {
      logger.warn("removeBgReplicateJob::unauthorized_missing_payload", requestMeta);
      return res.status(401).json({
        error: true,
        message: "Unauthorized: missing user payload",
        requestId: httpRequestId,
      });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      logger.warn("removeBgReplicateJob::user_not_found", {
        ...requestMeta,
        email,
      });
      return res.status(401).json({
        error: true,
        message: "Unauthorized: user not found",
        requestId: httpRequestId,
      });
    }

    const idempotencyKey = getIdempotencyKey(req);
    if (!idempotencyKey) {
      return res.status(400).json({
        error: true,
        message: "Missing idempotencyKey",
        requestId: httpRequestId,
      });
    }

    const image = (req as any).imageValidated as ValidatedImage | undefined;
    if (!image) {
      return res.status(400).json({
        error: true,
        message: "Aucune image valide n'a ete detectee.",
        requestId: httpRequestId,
      });
    }

    // Try to reuse an existing job (idempotency contract).
    const existing = await getRemoveBgJobByUserIdAndIdempotencyKey({
      userId: user.id,
      idempotencyKey,
    });
    if (existing) {
      publishRemoveBgJobUpdatedPayload({
        requestId: existing.request_id,
        status: existing.status,
        outputImageUrl: existing.output_image_url,
        errorMessage: existing.error_message,
        createdAt: existing.created_at,
        completedAt: existing.completed_at,
      });
      return res.status(200).json({
        requestId: existing.request_id,
        jobId: existing.id,
        predictionId: existing.replicate_prediction_id,
        status: existing.status,
      });
    }

    // Create a new job row.
    const requestId = getRequestIdFromClient(req) ?? crypto.randomUUID();
    const job = await createRemoveBgJobIdempotent({
      requestId,
      idempotencyKey,
      userId: user.id,
    });

    const replicateToken =
      process.env.REPLICATE_API_TOKEN ?? process.env.REPLICATE_API_KEY_WIZPIX;
    if (!replicateToken) {
      logger.error("removeBgReplicateJob::missing_replicate_token", requestMeta);
      return res.status(500).json({
        error: true,
        message:
          "Configuration manquante: REPLICATE_API_TOKEN (ou REPLICATE_API_KEY_WIZPIX).",
        requestId: httpRequestId,
      });
    }

    const publicBase = getPublicBackendBaseUrl();
    if (!publicBase) {
      logger.error("removeBgReplicateJob::missing_public_backend_url", requestMeta);
      return res.status(500).json({
        error: true,
        message:
          "Configuration manquante: REPLICATE_WEBHOOK_URL (dev) ou BASE_URL_PROD (prod).",
        requestId: httpRequestId,
      });
    }

    const webhookUrl = `${publicBase}/api/replicate/webhook?source=remove_bg_user&requestId=${encodeURIComponent(
      job.request_id,
    )}`;

    const replicate = new Replicate({
      auth: replicateToken,
      useFileOutput: true,
    });

    const modelKey = pickModelKey(req);
    const modelIdentifier = modelType[modelKey];
    const version = extractVersionFromIdentifier(modelIdentifier);

    // Async: create the prediction and return immediately (do not wait).
    const replicateCreateStartedAt = Date.now();
    const prediction = await replicate.predictions.create({
      version,
      input: {
        image: image.buffer,
      },
      webhook: webhookUrl,
      webhook_events_filter: ["start", "completed"],
    } as any);
    const replicateCreateMs = Date.now() - replicateCreateStartedAt;

    const predictionId = String((prediction as any)?.id ?? "").trim() || null;
    if (!predictionId) {
      logger.error("removeBgReplicateJob::prediction_create_missing_id", requestMeta);
      return res.status(502).json({
        error: true,
        message: "Replicate a renvoye une reponse invalide (prediction id manquant).",
        requestId: httpRequestId,
      });
    }

    await setRemoveBgJobRunning({
      requestId: job.request_id,
      replicatePredictionId: predictionId,
      replicateStatus: String((prediction as any)?.status ?? "") || "starting",
      replicatePayload: prediction as any,
    });
    logger.info("removeBgReplicateJob::prediction_created", {
      requestId: httpRequestId,
      jobRequestId: job.request_id,
      jobId: job.id,
      predictionId,
      replicateCreateMs,
      inputBytes: image.size,
      inputMime: image.mime,
      modelKey,
    });
    publishRemoveBgJobUpdatedPayload({
      requestId: job.request_id,
      status: "processing",
      outputImageUrl: null,
      errorMessage: null,
      createdAt: job.created_at,
      completedAt: null,
    });

    return res.status(201).json({
      requestId: job.request_id,
      jobId: job.id,
      predictionId,
      status: "processing",
    });
  } catch (err: any) {
    logger.error("removeBgReplicateJob::unhandled_error", {
      requestId: (req as any).requestId,
      message: err?.message ?? String(err),
      stack: err?.stack,
    });
    return res.status(500).json({
      error: true,
      message: "Erreur interne du serveur.",
      requestId: (req as any).requestId,
    });
  }
};
