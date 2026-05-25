import type { RequestHandler } from "express";
import fsPromises from "node:fs/promises";

import { getRemoveBgJobByRequestId, getUserByEmail } from "../../DB/queriesSQL/queriesSQL.js";
import { resolveStoredRemoveBgOutputPath } from "../../utils/images/storeOptimizedRemoveBgOutput.js";
import { logger } from "../../logger.js";

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

function isSucceeded(status: unknown): boolean {
  return String(status || "").toLowerCase() === "succeeded";
}

export const deleteRemoveBgReplicateJobOutput: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const requestIdParam = String(req.params?.requestId ?? "").trim();
  const token = readToken(req);

  const { email } =
    ((req as any).payload as { email?: string } | undefined) || {};
  if (!email) {
    logger.warn("deleteRemoveBgJobOutput::unauthorized_missing_payload", {
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err1",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(401).json({
      error: true,
      message: "Unauthorized",
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err1",
      requestId: httpRequestId,
    });
  }
  const user = await getUserByEmail(email);
  if (!user) {
    logger.warn("deleteRemoveBgJobOutput::unauthorized_user_not_found", {
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err2",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(401).json({
      error: true,
      message: "Unauthorized",
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err2",
      requestId: httpRequestId,
    });
  }

  if (!requestIdParam || !token) {
    logger.warn("deleteRemoveBgJobOutput::missing_requestId_or_token", {
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err3",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: requestIdParam,
    });
    return res.status(400).json({
      error: true,
      message: "missing_requestId_or_token",
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err3",
      requestId: httpRequestId,
    });
  }

  const job = await getRemoveBgJobByRequestId(requestIdParam);
  if (!job) {
    logger.warn("deleteRemoveBgJobOutput::job_not_found", {
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err4",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: requestIdParam,
      userId: user.id,
    });
    return res.status(404).json({
      error: true,
      message: "job_not_found",
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err4",
      requestId: httpRequestId,
    });
  }

  if (!job.user_id || job.user_id !== user.id) {
    logger.warn("deleteRemoveBgJobOutput::forbidden", {
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err5",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: job.request_id,
      userId: user.id,
    });
    return res.status(403).json({
      error: true,
      message: "forbidden",
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err5",
      requestId: httpRequestId,
    });
  }

  if (!isSucceeded(job.status) || !job.output_image_url) {
    logger.warn("deleteRemoveBgJobOutput::job_not_ready", {
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err6",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: job.request_id,
      userId: user.id,
      status: job.status,
    });
    return res.status(409).json({
      error: true,
      message: "job_not_ready",
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err6",
      requestId: httpRequestId,
    });
  }

  const expectedToken = extractTokenFromUrl(String(job.output_image_url));
  if (!expectedToken || expectedToken !== token) {
    logger.warn("deleteRemoveBgJobOutput::forbidden_token_mismatch", {
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err7",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      jobRequestId: job.request_id,
      userId: user.id,
    });
    return res.status(403).json({
      error: true,
      message: "forbidden",
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err7",
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
    logger.info("deleteRemoveBgJobOutput::deleted", {
      requestId: httpRequestId,
      jobRequestId: job.request_id,
      userId: user.id,
    });
    return res.status(200).json({ ok: true, deleted: true });
  } catch (err: any) {
    const code = String(err?.code || "");
    if (code === "ENOENT") {
      return res.status(200).json({ ok: true, deleted: false, alreadyDeleted: true });
    }
    logger.warn("deleteRemoveBgJobOutput::failed", {
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err8",
      requestId: httpRequestId,
      jobRequestId: job.request_id,
      userId: user.id,
      message: err?.message ?? String(err),
    });
    return res.status(500).json({
      ok: false,
      error: true,
      message: "internal_error",
      code: "ctrl_deleteRemoveBgReplicateJobOutput_err8",
      requestId: httpRequestId,
    });
  }
};
