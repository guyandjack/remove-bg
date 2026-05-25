import type { RequestHandler } from "express";

import Replicate from "replicate";
import { logger } from "../../logger.js";
import { getPublicBackendBaseUrl } from "../../utils/publicBackendUrl.js";
import { storeOptimizedRemoveBgOutput } from "../../utils/images/storeOptimizedRemoveBgOutput.js";
import {
  getRemoveBgVisitorJobByRequestId,
  markRemoveBgVisitorJobCanceled,
  markRemoveBgVisitorJobFailed,
  markRemoveBgVisitorJobSucceeded,
  setRemoveBgVisitorJobRunning,
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

function requireToken(req: any): string | null {
  const fromQuery = String(req.query?.token ?? "").trim();
  return fromQuery ? fromQuery : null;
}

export const getRemoveBgVisitorReplicateJob: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const requestIdParam = String(req.params?.requestId ?? "").trim();
  const token = requireToken(req);

  if (!requestIdParam || !token) {
    logger.warn("getRemoveBgVisitorReplicateJob::missing_requestId_or_token", {
      code: "ctrl_getRemoveBgVisitorReplicateJob_err1",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: requestIdParam,
    });
    return res.status(400).json({
      error: true,
      message: "missing_requestId_or_token",
      code: "ctrl_getRemoveBgVisitorReplicateJob_err1",
      requestId: httpRequestId,
    });
  }

  const job = await getRemoveBgVisitorJobByRequestId(requestIdParam);
  if (!job) {
    logger.warn("getRemoveBgVisitorReplicateJob::job_not_found", {
      code: "ctrl_getRemoveBgVisitorReplicateJob_err2",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: requestIdParam,
    });
    return res.status(404).json({
      error: true,
      message: "job_not_found",
      code: "ctrl_getRemoveBgVisitorReplicateJob_err2",
      requestId: httpRequestId,
    });
  }

  if (String(job.access_token || "") !== token) {
    logger.warn("getRemoveBgVisitorReplicateJob::forbidden_invalid_token", {
      code: "ctrl_getRemoveBgVisitorReplicateJob_err3",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: job.request_id,
    });
    return res.status(403).json({
      error: true,
      message: "forbidden",
      code: "ctrl_getRemoveBgVisitorReplicateJob_err3",
      requestId: httpRequestId,
    });
  }

  // Recovery path: reconcile from Replicate when webhook is missing.
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
              const publicBase = getPublicBackendBaseUrl();
              if (publicBase) {
                const stored = await storeOptimizedRemoveBgOutput({
                  requestId: job.request_id,
                  sourceUrl: outputUrl,
                  publicBaseUrl: publicBase,
                  outputEndpointPath:
                    `/api/services/public/remove-bg/jobs/${encodeURIComponent(
                      job.request_id,
                    )}/output`,
                });
                finalOutputUrl = stored.publicUrl;
              }
            } catch (err: any) {
              logger.warn("getRemoveBgVisitorReplicateJob::reconcile_optimize_failed", {
                code: "ctrl_getRemoveBgVisitorReplicateJob_err4",
                requestId: httpRequestId,
                jobId: job.id,
                predictionId: job.replicate_prediction_id,
                message: err?.message ?? String(err),
              });
            }

            await markRemoveBgVisitorJobSucceeded({
              requestId: job.request_id,
              outputImageUrl: finalOutputUrl,
              replicateStatus,
              replicatePayload: prediction as any,
              completedAt,
            });
          }
        } else if (replicateStatus === "failed") {
          await markRemoveBgVisitorJobFailed({
            requestId: job.request_id,
            errorMessage:
              (typeof (prediction as any)?.error === "string" && (prediction as any).error) ||
              "Le service de traitement a echoue.",
            replicateStatus,
            replicatePayload: prediction as any,
            completedAt,
          });
        } else if (replicateStatus === "canceled") {
          await markRemoveBgVisitorJobCanceled({
            requestId: job.request_id,
            errorMessage: "Traitement annule.",
            replicateStatus,
            replicatePayload: prediction as any,
            completedAt,
          });
        } else if (replicateStatus) {
          await setRemoveBgVisitorJobRunning({
            requestId: job.request_id,
            replicatePredictionId: job.replicate_prediction_id,
            replicateStatus,
            replicatePayload: prediction as any,
          });
        }

        const after = await getRemoveBgVisitorJobByRequestId(job.request_id);
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
        logger.warn("getRemoveBgVisitorReplicateJob::reconcile_failed", {
          code: "ctrl_getRemoveBgVisitorReplicateJob_err5",
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
