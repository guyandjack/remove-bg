import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import {
  tryMarkWebhookEventReceived,
  markWebhookEventProcessed,
  getRemoveBgJobByReplicatePredictionId,
  setRemoveBgJobRunning,
  markRemoveBgJobSucceeded,
  markRemoveBgJobFailed,
  markRemoveBgJobCanceled,
} from "../../DB/queriesSQL/queriesSQL.js";

function parseJsonBody(req: any): any | null {
  const body = req?.body;
  if (!Buffer.isBuffer(body) || body.length === 0) return null;
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
}

function getHeader(req: any, name: string): string | null {
  const raw = req?.headers?.[String(name).toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ? String(raw[0]) : null;
  if (typeof raw === "string") return raw;
  return raw != null ? String(raw) : null;
}

function extractOutputUrl(output: unknown): string | null {
  const actual = (output as any)?.output ?? output;
  if (typeof actual === "string" && /^https?:\/\//i.test(actual)) return actual;
  if (Array.isArray(actual) && actual.length > 0) {
    const first = actual[0];
    if (typeof first === "string" && /^https?:\/\//i.test(first)) return first;
  }
  return null;
}

export const replicateWebhook: RequestHandler = async (req, res) => {
  const requestId = (req as any).requestId;
  const webhookId = getHeader(req, "webhook-id");
  const eventId = webhookId ? `replicate:${webhookId}` : null;

  // Respond quickly: acknowledge receipt once we've made the request idempotent.
  // If the idempotency table is unavailable, return 500 so Replicate retries.
  if (eventId) {
    try {
      const { shouldProcess } = await tryMarkWebhookEventReceived({
        id: eventId,
        provider: "replicate",
        eventType: "replicate.webhook",
        receivedAt: new Date(),
      });
      if (!shouldProcess) {
        return res.status(200).json({ ok: true });
      }
    } catch (err: any) {
      logger.error("replicateWebhook::idempotency_mark_failed", {
        requestId,
        webhookId: webhookId ?? null,
        message: err?.message ?? String(err),
      });
      return res.status(500).json({ ok: false });
    }
  }

  const payload = parseJsonBody(req);
  if (!payload) {
    logger.warn("replicateWebhook::invalid_json", { requestId, webhookId });
    if (eventId) {
      try {
        await markWebhookEventProcessed({ id: eventId });
      } catch {}
    }
    return res.status(200).json({ ok: true });
  }

  const predictionId = String(payload?.id ?? "").trim();
  const replicateStatus = String(payload?.status ?? "").trim();

  if (!predictionId) {
    logger.warn("replicateWebhook::missing_prediction_id", { requestId, webhookId });
    if (eventId) {
      try {
        await markWebhookEventProcessed({ id: eventId });
      } catch {}
    }
    return res.status(200).json({ ok: true });
  }

  try {
    const job = await getRemoveBgJobByReplicatePredictionId(predictionId);
    if (!job) {
      logger.warn("replicateWebhook::job_not_found", {
        requestId,
        webhookId,
        predictionId,
        replicateStatus,
      });
      if (eventId) {
        try {
          await markWebhookEventProcessed({ id: eventId });
        } catch {}
      }
      return res.status(200).json({ ok: true });
    }

    const completedAt = new Date();

    if (replicateStatus === "succeeded") {
      const outputUrl = extractOutputUrl(payload?.output);
      if (outputUrl) {
        await markRemoveBgJobSucceeded({
          requestId: job.request_id,
          outputImageUrl: outputUrl,
          replicateStatus,
          replicatePayload: payload,
          completedAt,
        });
      } else {
        await markRemoveBgJobFailed({
          requestId: job.request_id,
          errorMessage: "Format de sortie Replicate non supporte.",
          replicateStatus,
          replicatePayload: payload,
          completedAt,
        });
      }
    } else if (replicateStatus === "failed") {
      await markRemoveBgJobFailed({
        requestId: job.request_id,
        errorMessage:
          (typeof payload?.error === "string" && payload.error) ||
          "Le service de traitement a echoue.",
        replicateStatus,
        replicatePayload: payload,
        completedAt,
      });
    } else if (replicateStatus === "canceled") {
      await markRemoveBgJobCanceled({
        requestId: job.request_id,
        errorMessage: "Traitement annule.",
        replicateStatus,
        replicatePayload: payload,
        completedAt,
      });
    } else if (replicateStatus) {
      // For "starting"/"processing"/etc: keep DB up to date but do not set completed_at.
      await setRemoveBgJobRunning({
        requestId: job.request_id,
        replicatePredictionId: predictionId,
        replicateStatus,
        replicatePayload: payload,
      });
    }
  } catch (err: any) {
    logger.error("replicateWebhook::update_failed", {
      requestId,
      webhookId,
      predictionId,
      replicateStatus,
      message: err?.message ?? String(err),
    });
    // Let Replicate retry (we're idempotent by webhook-id).
    return res.status(500).json({ ok: false });
  }

  if (webhookId) {
    try {
      await markWebhookEventProcessed({ id: eventId ?? webhookId });
    } catch {}
  }

  return res.status(200).json({ ok: true });
};
