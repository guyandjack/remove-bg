import Replicate from "replicate";
import type { RequestHandler } from "express";

import { logger } from "../../logger.js";
import {
  backfillRemoveBgJobOutputIfMissing,
  getRemoveBgJobByRequestId,
  getUserByEmail,
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
          const updated = await backfillRemoveBgJobOutputIfMissing({
            requestId: job.request_id,
            outputImageUrl: outputUrl,
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

