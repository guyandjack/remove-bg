import type { RequestHandler } from "express";

import { getRemoveBgVisitorJobByRequestId } from "../../DB/queriesSQL/queriesSQL.js";

function requireToken(req: any): string | null {
  const fromQuery = String(req.query?.token ?? "").trim();
  return fromQuery ? fromQuery : null;
}

export const getRemoveBgVisitorReplicateJob: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const requestIdParam = String(req.params?.requestId ?? "").trim();
  const token = requireToken(req);

  if (!requestIdParam || !token) {
    return res.status(400).json({
      error: true,
      message: "missing_requestId_or_token",
      requestId: httpRequestId,
    });
  }

  const job = await getRemoveBgVisitorJobByRequestId(requestIdParam);
  if (!job) {
    return res.status(404).json({
      error: true,
      message: "job_not_found",
      requestId: httpRequestId,
    });
  }

  if (String(job.access_token || "") !== token) {
    return res.status(403).json({
      error: true,
      message: "forbidden",
      requestId: httpRequestId,
    });
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

