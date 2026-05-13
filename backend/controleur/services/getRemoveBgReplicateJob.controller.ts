import Replicate from "replicate";
import type { RequestHandler } from "express";

import { logger } from "../../logger.js";
import { getPublicBackendBaseUrl } from "../../utils/publicBackendUrl.js";
import { storeOptimizedRemoveBgOutput } from "../../utils/images/storeOptimizedRemoveBgOutput.js";
import {
  backfillRemoveBgJobOutputIfMissing,
  getRemoveBgJobByRequestId,
  getUserByEmail,
  markRemoveBgJobCanceled,
  markRemoveBgJobFailed,
  markRemoveBgJobSucceeded,
  setRemoveBgJobRunning,
  getActiveUsageBillingPeriod,
  recordCreditUsage,
  markRemoveBgJobCreditsDebited,
} from "../../DB/queriesSQL/queriesSQL.js";

function extractOutputUrl(output: unknown): string | null {
  const actual = (output as any)?.output ?? output;
  if (typeof actual === "string" && /^https?:\/\//i.test(actual)) return actual;
  if (Array.isArray(actual) && actual.length > 0) {
    const first = actual[0];
    if (typeof first === "string" && /^https?:\/\//i.test(first)) return first;
  }
  return null;
}

export const getRemoveBgReplicateJob: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const requestIdParam = String(req.params?.requestId ?? "").trim();
  const host = req.get("host") || "";
  const protoHeader = (req.headers["x-forwarded-proto"] as string | undefined)
    ?.split(",")[0]
    ?.trim();
  const requestBaseUrl = host ? `${protoHeader || req.protocol}://${host}` : "";

  const { email } =
    ((req as any).payload as { email?: string } | undefined) || {};
  if (!email) {
    return res.status(401).json({
      error: true,
      message: "Unauthorized",
      requestId: httpRequestId,
    });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({
      error: true,
      message: "Unauthorized",
      requestId: httpRequestId,
    });
  }

  const job = await getRemoveBgJobByRequestId(requestIdParam);
  if (!job) {
    return res.status(404).json({
      error: true,
      message: "job_not_found",
      requestId: httpRequestId,
    });
  }

  if (!job.user_id || job.user_id !== user.id) {
    return res.status(403).json({
      error: true,
      message: "forbidden",
      requestId: httpRequestId,
    });
  }

  // Recovery path: if webhook did not arrive, reconcile the job status from Replicate on demand.
  // This keeps the UX functional even when the dev tunnel (REPLICATE_WEBHOOK_URL) is misconfigured/expired.
  if (
    (job.status === "pending" || job.status === "processing") &&
    job.replicate_prediction_id
  ) {
    const replicateToken =
      process.env.REPLICATE_API_TOKEN ?? process.env.REPLICATE_API_KEY_WIZPIX;
    if (replicateToken) {
      try {
        const replicate = new Replicate({ auth: replicateToken, useFileOutput: true });
        const prediction = await replicate.predictions.get(job.replicate_prediction_id);
        const replicateStatus = String((prediction as any)?.status ?? "").trim();

        const completedAt = new Date();

        if (replicateStatus === "succeeded") {
          const outputUrl = extractOutputUrl((prediction as any)?.output);
          if (outputUrl) {
            let finalOutputUrl = outputUrl;
            try {
              const publicBase = getPublicBackendBaseUrl() || requestBaseUrl;
              if (publicBase) {
                const stored = await storeOptimizedRemoveBgOutput({
                  requestId: job.request_id,
                  sourceUrl: outputUrl,
                  publicBaseUrl: publicBase,
                });
                finalOutputUrl = stored.publicUrl;
              }
            } catch (err: any) {
              logger.warn("getRemoveBgReplicateJob::reconcile_optimize_failed", {
                requestId: httpRequestId,
                jobId: job.id,
                predictionId: job.replicate_prediction_id,
                message: err?.message ?? String(err),
              });
            }

            await markRemoveBgJobSucceeded({
              requestId: job.request_id,
              outputImageUrl: finalOutputUrl,
              replicateStatus,
              replicatePayload: prediction as any,
              completedAt,
            });

            // Debit credits (idempotent).
            try {
              const refreshed = await getRemoveBgJobByRequestId(job.request_id);
              if (refreshed && refreshed.user_id && !refreshed.credits_debited_at) {
                const usage = await getActiveUsageBillingPeriod(refreshed.user_id);
                if (usage) {
                  const creditUsageId = await recordCreditUsage(
                    usage.subscription_id,
                    1,
                    "replicate_remove_bg",
                    refreshed.request_id,
                  );
                  if (creditUsageId) {
                    await markRemoveBgJobCreditsDebited({
                      requestId: refreshed.request_id,
                      debitedAt: completedAt,
                    });
                  }
                }
              }
            } catch (err: any) {
              logger.warn("getRemoveBgReplicateJob::reconcile_debit_failed", {
                requestId: httpRequestId,
                jobId: job.id,
                predictionId: job.replicate_prediction_id,
                message: err?.message ?? String(err),
              });
            }
          }
        } else if (replicateStatus === "failed") {
          await markRemoveBgJobFailed({
            requestId: job.request_id,
            errorMessage:
              (typeof (prediction as any)?.error === "string" && (prediction as any).error) ||
              "Le service de traitement a echoue.",
            replicateStatus,
            replicatePayload: prediction as any,
            completedAt,
          });
        } else if (replicateStatus === "canceled") {
          await markRemoveBgJobCanceled({
            requestId: job.request_id,
            errorMessage: "Traitement annule.",
            replicateStatus,
            replicatePayload: prediction as any,
            completedAt,
          });
        } else if (replicateStatus) {
          await setRemoveBgJobRunning({
            requestId: job.request_id,
            replicatePredictionId: job.replicate_prediction_id,
            replicateStatus,
            replicatePayload: prediction as any,
          });
        }

        const after = await getRemoveBgJobByRequestId(job.request_id);
        if (after) {
          return res.status(200).json({
            requestId: after.request_id,
            status: after.status,
            outputImageUrl: after.output_image_url,
            errorMessage: after.error_message,
            createdAt: after.created_at,
            completedAt: after.completed_at,
          });
        }
      } catch (err: any) {
        logger.warn("getRemoveBgReplicateJob::reconcile_failed", {
          requestId: httpRequestId,
          jobId: job.id,
          predictionId: job.replicate_prediction_id,
          message: err?.message ?? String(err),
        });
      }
    }
  }

  // If DB claims success but output URL is missing, attempt a best-effort backfill from Replicate.
  if (
    job.status === "succeeded" &&
    (!job.output_image_url || String(job.output_image_url).trim() === "") &&
    job.replicate_prediction_id
  ) {
    const replicateToken =
      process.env.REPLICATE_API_TOKEN ?? process.env.REPLICATE_API_KEY_WIZPIX;
    if (replicateToken) {
      try {
        const replicate = new Replicate({
          auth: replicateToken,
          useFileOutput: true,
        });
        const prediction = await replicate.predictions.get(
          job.replicate_prediction_id,
        );
        const replicateStatus = String((prediction as any)?.status ?? "").trim();
        const outputUrl = extractOutputUrl((prediction as any)?.output);

        if (replicateStatus === "succeeded" && outputUrl) {
          let finalOutputUrl = outputUrl;
          try {
            const publicBase = getPublicBackendBaseUrl() || requestBaseUrl;
            if (publicBase) {
              const stored = await storeOptimizedRemoveBgOutput({
                requestId: job.request_id,
                sourceUrl: outputUrl,
                publicBaseUrl: publicBase,
              });
              finalOutputUrl = stored.publicUrl;
              logger.info("getRemoveBgReplicateJob::output_optimized", {
                requestId: httpRequestId,
                jobId: job.id,
                jobRequestId: job.request_id,
                predictionId: job.replicate_prediction_id,
                bytesRaw: stored.bytesRaw,
                bytesOptimized: stored.bytesOptimized,
              });
            }
          } catch (err: any) {
            logger.warn("getRemoveBgReplicateJob::output_optimize_failed", {
              requestId: httpRequestId,
              jobId: job.id,
              predictionId: job.replicate_prediction_id,
              message: err?.message ?? String(err),
            });
          }

          const updated = await backfillRemoveBgJobOutputIfMissing({
            requestId: job.request_id,
            outputImageUrl: finalOutputUrl,
            replicateStatus,
            replicatePayload: prediction as any,
            completedAt: new Date(),
          });
          logger.info("getRemoveBgReplicateJob::backfill_output", {
            requestId: httpRequestId,
            jobId: job.id,
            jobRequestId: job.request_id,
            predictionId: job.replicate_prediction_id,
            updated,
          });
          if (updated) {
            const refreshed = await getRemoveBgJobByRequestId(job.request_id);
            if (refreshed) {
              return res.status(200).json({
                requestId: refreshed.request_id,
                status: refreshed.status,
                outputImageUrl: refreshed.output_image_url,
                errorMessage: refreshed.error_message,
                createdAt: refreshed.created_at,
                completedAt: refreshed.completed_at,
              });
            }
          }
        }
      } catch (err: any) {
        logger.warn("getRemoveBgReplicateJob::backfill_failed", {
          requestId: httpRequestId,
          jobId: job.id,
          predictionId: job.replicate_prediction_id,
          message: err?.message ?? String(err),
        });
      }
    }
  }

  return res.status(200).json({
    requestId: job.request_id,
    status: job.status,
    outputImageUrl: job.output_image_url,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  });
};
