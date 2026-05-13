import crypto from "node:crypto";
import Replicate from "replicate";

import type { RequestHandler } from "express";
import type { ValidatedImage } from "../../middelware/checkDataUpload/checkDataUpload.js";
import { logger } from "../../logger.js";
import { getHashedVisitorIp } from "../../utils/visitorIpHash.js";
import { getPublicBackendBaseUrl } from "../../utils/publicBackendUrl.js";
import { tryConsumeRemoveBgTrial } from "../../DB/queriesSQL/visitorQuota.queries.js";
import {
  createRemoveBgVisitorJobIdempotent,
  getRemoveBgVisitorJobByVisitorHashAndIdempotencyKey,
  setRemoveBgVisitorJobRunning,
} from "../../DB/queriesSQL/queriesSQL.js";
import {
  publishRemoveBgJobUpdatedPayloadToChannel,
} from "../../services/removeBgJobs/removeBgJobEvents.js";

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

function setVisitorQuotaHeaders(res: any, snapshot: { used: number; limit: number }) {
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-Wizpix-Visitor-Quota-Service,X-Wizpix-Visitor-Quota-Used,X-Wizpix-Visitor-Quota-Limit",
  );
  res.setHeader("X-Wizpix-Visitor-Quota-Service", "remove_bg");
  res.setHeader("X-Wizpix-Visitor-Quota-Used", String(snapshot.used));
  res.setHeader("X-Wizpix-Visitor-Quota-Limit", String(snapshot.limit));
}

export const createRemoveBgVisitorReplicateJob: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const requestMeta = {
    requestId: httpRequestId,
    method: req.method,
    path: req.originalUrl || req.url,
  };

  try {
    const replicateToken =
      process.env.REPLICATE_API_TOKEN ?? process.env.REPLICATE_API_KEY_WIZPIX;
    if (!replicateToken) {
      logger.error(
        "removeBgVisitorReplicateJob::missing_replicate_token",
        requestMeta,
      );
      return res.status(500).json({
        error: true,
        code: "CONFIG_MISSING",
        message:
          "Configuration manquante: REPLICATE_API_TOKEN (ou REPLICATE_API_KEY_WIZPIX).",
        requestId: httpRequestId,
      });
    }

    const image = (req as any).imageValidated as ValidatedImage | undefined;
    if (!image) {
      logger.warn("removeBgVisitorReplicateJob::missing_validated_image", requestMeta);
      return res.status(400).json({
        error: true,
        code: "INVALID_IMAGE",
        message: "Aucune image valide n'a ete detectee.",
        requestId: httpRequestId,
      });
    }

    const idempotencyKey = getIdempotencyKey(req);
    if (!idempotencyKey) {
      return res.status(400).json({
        error: true,
        code: "MISSING_IDEMPOTENCY_KEY",
        message: "Missing idempotencyKey",
        requestId: httpRequestId,
      });
    }

    const { hashedIp, hashSuffix } = getHashedVisitorIp(req);

    const existing = await getRemoveBgVisitorJobByVisitorHashAndIdempotencyKey({
      visitorHashedIp: hashedIp,
      idempotencyKey,
    });
    if (existing) {
      publishRemoveBgJobUpdatedPayloadToChannel(`visitor:${existing.request_id}`, {
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
        accessToken: existing.access_token,
        predictionId: existing.replicate_prediction_id,
        status: existing.status,
      });
    }

    // Visitor quota is consumed at job creation time (cost is incurred even if the user disconnects).
    const snapshot = await tryConsumeRemoveBgTrial(hashedIp);
    setVisitorQuotaHeaders(res, snapshot);
    if (!snapshot.allowed) {
      logger.info("removeBgVisitorReplicateJob::quota_blocked", {
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
        requestId: httpRequestId,
        quota: { service: "remove_bg", used: snapshot.used, limit: snapshot.limit },
      });
    }

    const requestId = getRequestIdFromClient(req) ?? crypto.randomUUID();
    const job = await createRemoveBgVisitorJobIdempotent({
      requestId,
      idempotencyKey,
      visitorHashedIp: hashedIp,
    });

    const publicBase = getPublicBackendBaseUrl();
    if (!publicBase) {
      logger.error("removeBgVisitorReplicateJob::missing_public_backend_url", requestMeta);
      return res.status(500).json({
        error: true,
        code: "CONFIG_MISSING",
        message:
          "Configuration manquante: REPLICATE_WEBHOOK_URL (dev) ou BASE_URL_PROD (prod).",
        requestId: httpRequestId,
      });
    }

    const webhookUrl = `${publicBase}/api/replicate/webhook?source=remove_bg_visitor&requestId=${encodeURIComponent(
      job.request_id,
    )}`;

    const replicate = new Replicate({
      auth: replicateToken,
      useFileOutput: true,
    });

    const modelKey = pickModelKey(req);
    const modelIdentifier = modelType[modelKey];
    const version = extractVersionFromIdentifier(modelIdentifier);

    const prediction = await replicate.predictions.create({
      version,
      input: { image: image.buffer },
      webhook: webhookUrl,
      webhook_events_filter: ["start", "completed"],
    } as any);

    const predictionId = String((prediction as any)?.id ?? "").trim() || null;
    if (!predictionId) {
      logger.error("removeBgVisitorReplicateJob::prediction_create_missing_id", requestMeta);
      return res.status(502).json({
        error: true,
        code: "UPSTREAM_ERROR",
        message: "Replicate a renvoye une reponse invalide (prediction id manquant).",
        requestId: httpRequestId,
      });
    }

    await setRemoveBgVisitorJobRunning({
      requestId: job.request_id,
      replicatePredictionId: predictionId,
      replicateStatus: String((prediction as any)?.status ?? "") || "starting",
      replicatePayload: prediction as any,
    });

    publishRemoveBgJobUpdatedPayloadToChannel(`visitor:${job.request_id}`, {
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
      accessToken: job.access_token,
      predictionId,
      status: "processing",
    });
  } catch (err: any) {
    logger.error("removeBgVisitorReplicateJob::unhandled_error", {
      requestId: (req as any).requestId,
      message: err?.message ?? String(err),
      stack: err?.stack,
    });
    return res.status(500).json({
      error: true,
      code: "INTERNAL_ERROR",
      message: "Erreur interne du serveur.",
      requestId: (req as any).requestId,
    });
  }
};
