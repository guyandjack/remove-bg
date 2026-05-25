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
  markRemoveBgVisitorJobFailed,
  setRemoveBgVisitorJobRunning,
} from "../../DB/queriesSQL/queriesSQL.js";
import {
  publishRemoveBgJobUpdatedPayloadToChannel,
} from "../../services/removeBgJobs/removeBgJobEvents.js";

const REPLICATE_TIMEOUT_MS =
  Number(process.env.REPLICATE_TIMEOUT_MS ?? "120000") || 120000;

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

function isAbortLikeError(err: any): boolean {
  if (!err) return false;
  if (err?.name === "AbortError") return true;
  if (String(err?.code || "") === "ABORT_ERR") return true;
  return false;
}

function upstreamHttpStatus(err: any): number | null {
  const status = err?.response?.status;
  return typeof status === "number" ? status : null;
}

function safeTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function describeFetchFailure(err: any): Record<string, any> {
  const cause = err?.cause;
  if (!cause || typeof cause !== "object") return {};

  // Undici/Node fetch errors often expose details on `cause`.
  const out: Record<string, any> = {};
  for (const k of ["code", "errno", "syscall", "address", "port", "host", "hostname"] as const) {
    const v = (cause as any)[k];
    if (v != null && v !== "") out[`cause_${k}`] = v;
  }
  return out;
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
      logger.error("removeBgVisitorReplicateJob::missing_replicate_token", {
        code: "ctrl_removeBgVisitorReplicateJobs_err1",
        ...requestMeta,
      });
      return res.status(500).json({
        error: true,
        code: "ctrl_removeBgVisitorReplicateJobs_err1",
        message:
          "Configuration manquante: REPLICATE_API_TOKEN (ou REPLICATE_API_KEY_WIZPIX).",
        requestId: httpRequestId,
      });
    }

    const image = (req as any).imageValidated as ValidatedImage | undefined;
    if (!image) {
      logger.warn("removeBgVisitorReplicateJob::missing_validated_image", {
        code: "ctrl_removeBgVisitorReplicateJobs_err2",
        ...requestMeta,
      });
      return res.status(400).json({
        error: true,
        code: "ctrl_removeBgVisitorReplicateJobs_err2",
        message: "Aucune image valide n'a ete detectee.",
        requestId: httpRequestId,
      });
    }

    const idempotencyKey = getIdempotencyKey(req);
    if (!idempotencyKey) {
      logger.warn("removeBgVisitorReplicateJob::missing_idempotency_key", {
        code: "ctrl_removeBgVisitorReplicateJobs_err3",
        ...requestMeta,
      });
      return res.status(400).json({
        error: true,
        code: "ctrl_removeBgVisitorReplicateJobs_err3",
        message: "Parametre manquant: idempotencyKey",
        requestId: httpRequestId,
      });
    }

    const publicBase = getPublicBackendBaseUrl();
    if (!publicBase) {
      logger.error("removeBgVisitorReplicateJob::missing_public_backend_url", {
        code: "ctrl_removeBgVisitorReplicateJobs_err4",
        ...requestMeta,
      });
      return res.status(500).json({
        error: true,
        code: "ctrl_removeBgVisitorReplicateJobs_err4",
        message:
          "Configuration manquante: REPLICATE_WEBHOOK_URL (dev) ou BASE_URL_PROD (prod).",
        requestId: httpRequestId,
      });
    }

    const modelKey = pickModelKey(req);
    const modelIdentifier = modelType[modelKey];
    const version = extractVersionFromIdentifier(modelIdentifier);

    const { hashedIp, hashSuffix } = getHashedVisitorIp(req);

    const existing = await getRemoveBgVisitorJobByVisitorHashAndIdempotencyKey({
      visitorHashedIp: hashedIp,
      idempotencyKey,
    });
    if (existing) {
      // Idempotency contract: for the same visitor + idempotency key, return the same job
      // and avoid consuming quota again.
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
        code: "ctrl_removeBgVisitorReplicateJobs_err5",
        ...requestMeta,
        visitorHashSuffix: hashSuffix,
        used: snapshot.used,
        limit: snapshot.limit,
      });
      return res.status(429).json({
        error: true,
        code: "ctrl_removeBgVisitorReplicateJobs_err5",
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

    const webhookUrl = `${publicBase}/api/replicate/webhook?source=remove_bg_visitor&requestId=${encodeURIComponent(
      job.request_id,
    )}`;

    const replicate = new Replicate({
      auth: replicateToken,
      useFileOutput: true,
    });

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), REPLICATE_TIMEOUT_MS);

    let prediction: any;
    const replicateCreateStartedAt = Date.now();
    try {
      prediction = await replicate.predictions.create({
        version,
        input: { image: image.buffer },
        webhook: webhookUrl,
        webhook_events_filter: ["start", "completed"],
        signal: abortController.signal,
      } as any);
    } catch (error: any) {
      const isAbort = isAbortLikeError(error) || abortController.signal.aborted;
      const status = upstreamHttpStatus(error);
      const message = safeTrimmedString(error?.message || error);

      logger.error("removeBgVisitorReplicateJob::prediction_create_failed", {
        code: "ctrl_removeBgVisitorReplicateJobs_err6",
        ...requestMeta,
        jobRequestId: job.request_id,
        jobId: job.id,
        modelKey,
        isAbort,
        upstreamStatus: status,
        message,
        ...describeFetchFailure(error),
      });

      const clientMessage = isAbort
        ? "Timeout: le service de traitement n'a pas repondu a temps."
        : status && status >= 400 && status < 500
          ? "Requete invalide pour le service de traitement."
          : "Le service de suppression de fond est indisponible pour le moment.";

      try {
        await markRemoveBgVisitorJobFailed({
          requestId: job.request_id,
          errorMessage: clientMessage,
          replicateStatus: isAbort ? "timeout" : null,
          replicatePayload: { message, upstreamStatus: status },
          completedAt: new Date(),
        });
      } catch (dbErr: any) {
        logger.warn("removeBgVisitorReplicateJob::mark_failed_db_error", {
          code: "ctrl_removeBgVisitorReplicateJobs_err7",
          ...requestMeta,
          jobRequestId: job.request_id,
          jobId: job.id,
          message: dbErr?.message ?? String(dbErr),
        });
      }

      publishRemoveBgJobUpdatedPayloadToChannel(`visitor:${job.request_id}`, {
        requestId: job.request_id,
        status: "failed",
        outputImageUrl: null,
        errorMessage: clientMessage,
        createdAt: job.created_at,
        completedAt: new Date(),
      });

      const httpStatus = isAbort ? 504 : 502;
      return res.status(httpStatus).json({
        error: true,
        code: "ctrl_removeBgVisitorReplicateJobs_err8",
        message: clientMessage,
        requestId: httpRequestId,
        jobRequestId: job.request_id,
      });
    } finally {
      clearTimeout(timeout);
    }
    const replicateCreateMs = Date.now() - replicateCreateStartedAt;

    const predictionId = String((prediction as any)?.id ?? "").trim() || null;
    if (!predictionId) {
      logger.error("removeBgVisitorReplicateJob::prediction_create_missing_id", {
        code: "ctrl_removeBgVisitorReplicateJobs_err9",
        ...requestMeta,
        jobRequestId: job.request_id,
        jobId: job.id,
        modelKey,
      });

      const clientMessage =
        "Le service de traitement a renvoye une reponse invalide (prediction id manquant).";

      try {
        await markRemoveBgVisitorJobFailed({
          requestId: job.request_id,
          errorMessage: clientMessage,
          replicateStatus: "invalid_response",
          replicatePayload: prediction as any,
          completedAt: new Date(),
        });
      } catch {}

      publishRemoveBgJobUpdatedPayloadToChannel(`visitor:${job.request_id}`, {
        requestId: job.request_id,
        status: "failed",
        outputImageUrl: null,
        errorMessage: clientMessage,
        createdAt: job.created_at,
        completedAt: new Date(),
      });

      return res.status(502).json({
        error: true,
        code: "ctrl_removeBgVisitorReplicateJobs_err10",
        message: clientMessage,
        requestId: httpRequestId,
        jobRequestId: job.request_id,
      });
    }

    await setRemoveBgVisitorJobRunning({
      requestId: job.request_id,
      replicatePredictionId: predictionId,
      replicateStatus: String((prediction as any)?.status ?? "") || "starting",
      replicatePayload: prediction as any,
    });

    logger.info("removeBgVisitorReplicateJob::prediction_created", {
      requestId: httpRequestId,
      jobRequestId: job.request_id,
      jobId: job.id,
      predictionId,
      replicateCreateMs,
      inputBytes: image.size,
      inputMime: image.mime,
      modelKey,
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
      code: "ctrl_removeBgVisitorReplicateJobs_err11",
      requestId: (req as any).requestId,
      message: err?.message ?? String(err),
      stack: err?.stack,
    });
    return res.status(500).json({
      error: true,
      code: "ctrl_removeBgVisitorReplicateJobs_err11",
      message: "Erreur interne du serveur.",
      requestId: (req as any).requestId,
    });
  }
};
