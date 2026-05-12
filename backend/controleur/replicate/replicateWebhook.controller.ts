import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import { getPublicBackendBaseUrl } from "../../utils/publicBackendUrl.js";
import {
  tryMarkWebhookEventReceived,
  markWebhookEventProcessed,
  getRemoveBgJobByReplicatePredictionId,
  getRemoveBgJobByRequestId,
  setRemoveBgJobRunning,
  markRemoveBgJobSucceeded,
  markRemoveBgJobFailed,
  markRemoveBgJobCanceled,
  getActiveUsageBillingPeriod,
  recordCreditUsage,
  markRemoveBgJobCreditsDebited,
} from "../../DB/queriesSQL/queriesSQL.js";
import { publishRemoveBgJobUpdatedPayload } from "../../services/removeBgJobs/removeBgJobEvents.js";
import { storeOptimizedRemoveBgOutput } from "../../utils/images/storeOptimizedRemoveBgOutput.js";

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
  const receivedAt = new Date();

  // Respond quickly: acknowledge receipt once we've made the request idempotent.
  // If the idempotency table is unavailable, return 500 so Replicate retries.
  if (eventId) {
    try {
      const { shouldProcess } = await tryMarkWebhookEventReceived({
        id: eventId,
        provider: "replicate",
        eventType: "replicate.webhook",
        receivedAt,
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
    const previousStatus = job.status;
    const previousReplicateStatus = job.replicate_status;

    if (replicateStatus === "succeeded") {
      const outputUrl = extractOutputUrl(payload?.output);
      if (outputUrl) {
        let finalOutputUrl = outputUrl;
        try {
          const publicBase = getPublicBackendBaseUrl();
          if (publicBase) {
            const stored = await storeOptimizedRemoveBgOutput({
              requestId: job.request_id,
              sourceUrl: outputUrl,
              publicBaseUrl: publicBase,
            });
            finalOutputUrl = stored.publicUrl;
            logger.info("replicateWebhook::output_optimized", {
              requestId,
              webhookId,
              predictionId,
              jobId: job.id,
              bytesRaw: stored.bytesRaw,
              bytesOptimized: stored.bytesOptimized,
            });
          } else {
            logger.warn("replicateWebhook::output_optimize_skip_no_public_base", {
              requestId,
              webhookId,
              predictionId,
              jobId: job.id,
            });
          }
        } catch (err: any) {
          logger.warn("replicateWebhook::output_optimize_failed", {
            requestId,
            webhookId,
            predictionId,
            jobId: job.id,
            message: err?.message ?? String(err),
          });
        }

        await markRemoveBgJobSucceeded({
          requestId: job.request_id,
          outputImageUrl: finalOutputUrl,
          replicateStatus,
          replicatePayload: payload,
          completedAt,
        });

        // Debit credits strictly on succeeded, and only once.
        if (!job.user_id) {
          logger.warn("replicateWebhook::credits_skip_missing_user", {
            requestId,
            webhookId,
            predictionId,
            jobId: job.id,
          });
        } else if (job.credits_debited_at) {
          logger.info("replicateWebhook::credits_already_debited", {
            requestId,
            webhookId,
            predictionId,
            jobId: job.id,
            debitedAt: job.credits_debited_at,
          });
        } else {
          // 1) Validate access/usage at debit time (source of truth: Replicate webhook success).
          const usage = await getActiveUsageBillingPeriod(job.user_id);
          if (!usage) {
            logger.error("replicateWebhook::credits_no_active_usage", {
              requestId,
              webhookId,
              predictionId,
              jobId: job.id,
              userId: job.user_id,
            });
            // Do not mark webhook as processed: allow Replicate retries.
            return res.status(500).json({ ok: false });
          }

          // 2) Ledger insert (idempotent by request_id due to unique index on CreditUsage.request_id).
          const creditUsageId = await recordCreditUsage(
            usage.subscription_id,
            1,
            "replicate_remove_bg",
            job.request_id,
          );
          if (!creditUsageId) {
            logger.error("replicateWebhook::credits_record_failed", {
              requestId,
              webhookId,
              predictionId,
              jobId: job.id,
              subscriptionId: usage.subscription_id,
            });
            return res.status(500).json({ ok: false });
          }

          // 3) Mark job as debited (guarded by credits_debited_at IS NULL).
          const marked = await markRemoveBgJobCreditsDebited({
            requestId: job.request_id,
            debitedAt: completedAt,
          });

          logger.info("replicateWebhook::credits_debit", {
            requestId,
            webhookId,
            predictionId,
            jobId: job.id,
            userId: job.user_id,
            subscriptionId: usage.subscription_id,
            creditUsageId,
            marked,
          });
        }

        // Notify SSE subscribers (payload is derived from DB, which remains source of truth).
        try {
          const latest = await getRemoveBgJobByRequestId(job.request_id);
          if (latest) {
            publishRemoveBgJobUpdatedPayload({
              requestId: latest.request_id,
              status: latest.status,
              outputImageUrl: latest.output_image_url,
              errorMessage: latest.error_message,
              createdAt: latest.created_at,
              completedAt: latest.completed_at,
            });
          }
        } catch {}
      } else {
        await markRemoveBgJobFailed({
          requestId: job.request_id,
          errorMessage: "Format de sortie Replicate non supporte.",
          replicateStatus,
          replicatePayload: payload,
          completedAt,
        });
        try {
          const latest = await getRemoveBgJobByRequestId(job.request_id);
          if (latest) {
            publishRemoveBgJobUpdatedPayload({
              requestId: latest.request_id,
              status: latest.status,
              outputImageUrl: latest.output_image_url,
              errorMessage: latest.error_message,
              createdAt: latest.created_at,
              completedAt: latest.completed_at,
            });
          }
        } catch {}
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
      try {
        const latest = await getRemoveBgJobByRequestId(job.request_id);
        if (latest) {
          publishRemoveBgJobUpdatedPayload({
            requestId: latest.request_id,
            status: latest.status,
            outputImageUrl: latest.output_image_url,
            errorMessage: latest.error_message,
            createdAt: latest.created_at,
            completedAt: latest.completed_at,
          });
        }
      } catch {}
    } else if (replicateStatus === "canceled") {
      await markRemoveBgJobCanceled({
        requestId: job.request_id,
        errorMessage: "Traitement annule.",
        replicateStatus,
        replicatePayload: payload,
        completedAt,
      });
      try {
        const latest = await getRemoveBgJobByRequestId(job.request_id);
        if (latest) {
          publishRemoveBgJobUpdatedPayload({
            requestId: latest.request_id,
            status: latest.status,
            outputImageUrl: latest.output_image_url,
            errorMessage: latest.error_message,
            createdAt: latest.created_at,
            completedAt: latest.completed_at,
          });
        }
      } catch {}
    } else if (replicateStatus) {
      // For "starting"/"processing"/etc: keep DB up to date but do not set completed_at.
      await setRemoveBgJobRunning({
        requestId: job.request_id,
        replicatePredictionId: predictionId,
        replicateStatus,
        replicatePayload: payload,
      });
      try {
        const latest = await getRemoveBgJobByRequestId(job.request_id);
        if (latest) {
          publishRemoveBgJobUpdatedPayload({
            requestId: latest.request_id,
            status: latest.status,
            outputImageUrl: latest.output_image_url,
            errorMessage: latest.error_message,
            createdAt: latest.created_at,
            completedAt: latest.completed_at,
          });
        }
      } catch {}
    }

    logger.info("replicateWebhook::job_transition", {
      requestId,
      webhookId,
      predictionId,
      jobId: job.id,
      from: { status: previousStatus, replicate_status: previousReplicateStatus },
      to: {
        status:
          replicateStatus === "succeeded"
            ? "succeeded"
            : replicateStatus === "failed"
              ? "failed"
              : replicateStatus === "canceled"
                ? "canceled"
                : "processing",
        replicate_status: replicateStatus,
      },
    });
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
