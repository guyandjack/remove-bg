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
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }
  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }

  if (!requestIdParam || !token) {
    return res.status(400).json({
      error: true,
      message: "missing_requestId_or_token",
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

  if (!isSucceeded(job.status) || !job.output_image_url) {
    return res.status(409).json({
      error: true,
      message: "job_not_ready",
      requestId: httpRequestId,
    });
  }

  const expectedToken = extractTokenFromUrl(String(job.output_image_url));
  if (!expectedToken || expectedToken !== token) {
    return res.status(403).json({
      error: true,
      message: "forbidden",
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
      requestId: httpRequestId,
      jobRequestId: job.request_id,
      userId: user.id,
      message: err?.message ?? String(err),
    });
    return res.status(500).json({ ok: false, error: true });
  }
};

