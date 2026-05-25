import type { RequestHandler } from "express";
import fsPromises from "node:fs/promises";

import { logger } from "../../logger.js";
import { getHashedVisitorIp } from "../../utils/visitorIpHash.js";
import { getRemoveBgVisitorJobByRequestId } from "../../DB/queriesSQL/queriesSQL.js";
import { resolveStoredRemoveBgOutputPath } from "../../utils/images/storeOptimizedRemoveBgOutput.js";

function extractTokenFromUrl(url: string): string | null {
  const raw = String(url || "").trim();
  if (!raw) return null;
  const idx = raw.indexOf("token=");
  if (idx === -1) return null;
  const after = raw.slice(idx + "token=".length);
  const amp = after.indexOf("&");
  const value = (amp === -1 ? after : after.slice(0, amp)).trim();
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readToken(req: any): string | null {
  const fromQuery = String(req.query?.token ?? "").trim();
  const fromBody = String(req.body?.token ?? "").trim();
  return (fromQuery || fromBody) ? (fromQuery || fromBody) : null;
}

function readAccessToken(req: any): string | null {
  const fromQuery = String(req.query?.accessToken ?? "").trim();
  const fromBody =
    String(req.body?.accessToken ?? "").trim() ||
    String(req.body?.access_token ?? "").trim();
  return (fromQuery || fromBody) ? (fromQuery || fromBody) : null;
}

function isSucceeded(status: unknown): boolean {
  return String(status || "").toLowerCase() === "succeeded";
}

export const deleteRemoveBgVisitorReplicateJobOutput: RequestHandler = async (
  req,
  res,
) => {
  const httpRequestId = (req as any).requestId;
  const requestIdParam = String(req.params?.requestId ?? "").trim();
  const token = readToken(req);
  const accessToken = readAccessToken(req);

  if (!requestIdParam || !token || !accessToken) {
    logger.warn("deleteRemoveBgVisitorJobOutput::missing_requestId_or_token_or_accessToken", {
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err1",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: requestIdParam,
    });
    return res.status(400).json({
      error: true,
      message: "missing_requestId_or_token_or_accessToken",
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err1",
      requestId: httpRequestId,
    });
  }

  const job = await getRemoveBgVisitorJobByRequestId(requestIdParam);
  if (!job) {
    logger.warn("deleteRemoveBgVisitorJobOutput::job_not_found", {
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err2",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: requestIdParam,
    });
    return res.status(404).json({
      error: true,
      message: "job_not_found",
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err2",
      requestId: httpRequestId,
    });
  }

  if (String(job.access_token || "") !== accessToken) {
    logger.warn("deleteRemoveBgVisitorJobOutput::forbidden_invalid_access_token", {
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err3",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: job.request_id,
    });
    return res.status(403).json({
      error: true,
      message: "forbidden",
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err3",
      requestId: httpRequestId,
    });
  }

  // Best-effort link to the same visitor (IP hash).
  try {
    const { hashedIp } = getHashedVisitorIp(req);
    if (hashedIp !== String(job.visitor_hashed_ip || "")) {
      logger.warn("deleteRemoveBgVisitorJobOutput::forbidden_visitor_hash_mismatch", {
        code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err4",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
        jobRequestId: job.request_id,
      });
      return res.status(403).json({
        error: true,
        message: "forbidden",
        code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err4",
        requestId: httpRequestId,
      });
    }
  } catch (err: any) {
    logger.warn("deleteRemoveBgVisitorJobOutput::visitor_hash_unavailable", {
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err5",
      requestId: httpRequestId,
      jobRequestId: job.request_id,
      message: err?.message ?? String(err),
    });
    // If we can't resolve the IP hash, do not allow deletion.
    return res.status(403).json({
      error: true,
      message: "forbidden",
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err5",
      requestId: httpRequestId,
    });
  }

  if (!isSucceeded(job.status) || !job.output_image_url) {
    logger.warn("deleteRemoveBgVisitorJobOutput::job_not_ready", {
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err6",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: job.request_id,
      status: job.status,
    });
    return res.status(409).json({
      error: true,
      message: "job_not_ready",
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err6",
      requestId: httpRequestId,
    });
  }

  const expectedToken = extractTokenFromUrl(String(job.output_image_url));
  if (!expectedToken || expectedToken !== token) {
    logger.warn("deleteRemoveBgVisitorJobOutput::forbidden_token_mismatch", {
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err7",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: job.request_id,
    });
    return res.status(403).json({
      error: true,
      message: "forbidden",
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err7",
      requestId: httpRequestId,
    });
  }

  const { filePath } = await resolveStoredRemoveBgOutputPath({
    requestId: job.request_id,
    token,
    extension: "png",
  });

  try {
    await fsPromises.unlink(filePath);
    logger.info("deleteRemoveBgVisitorJobOutput::deleted", {
      requestId: httpRequestId,
      jobRequestId: job.request_id,
    });
    return res.status(200).json({ ok: true, deleted: true });
  } catch (err: any) {
    const code = String(err?.code || "");
    if (code === "ENOENT") {
      return res
        .status(200)
        .json({ ok: true, deleted: false, alreadyDeleted: true });
    }
    logger.warn("deleteRemoveBgVisitorJobOutput::failed", {
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err8",
      requestId: httpRequestId,
      jobRequestId: job.request_id,
      message: err?.message ?? String(err),
    });
    return res.status(500).json({
      ok: false,
      error: true,
      message: "internal_error",
      code: "ctrl_deleteRemoveBgVisitorReplicateJobOutput_err8",
      requestId: httpRequestId,
    });
  }
};
