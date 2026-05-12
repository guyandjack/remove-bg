import type { RequestHandler } from "express";
import fs from "node:fs";
import fsPromises from "node:fs/promises";

import { logger } from "../../logger.js";
import { getRemoveBgJobByRequestId } from "../../DB/queriesSQL/queriesSQL.js";
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

function isSucceeded(status: unknown): boolean {
  return String(status || "").toLowerCase() === "succeeded";
}

export const downloadRemoveBgReplicateJobOutput: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const requestIdParam = String(req.params?.requestId ?? "").trim();
  const token = String(req.query?.token ?? "").trim();

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

  if (!isSucceeded(job.status) || !job.output_image_url) {
    return res.status(409).json({
      error: true,
      message: "job_not_ready",
      requestId: httpRequestId,
    });
  }

  // One-shot privacy guard:
  // only allow download when the presented token matches what we previously issued.
  const expectedToken = extractTokenFromUrl(String(job.output_image_url));
  if (!expectedToken || expectedToken !== token) {
    return res.status(403).json({
      error: true,
      message: "forbidden",
      requestId: httpRequestId,
    });
  }

  const { filePath, filename } = await resolveStoredRemoveBgOutputPath({
    requestId: job.request_id,
    token,
    extension: "png",
  });

  // Stream file (avoid loading full buffer in memory).
  let deleted = false;
  const deleteFile = async (reason: string) => {
    if (deleted) return;
    deleted = true;
    try {
      await fsPromises.unlink(filePath);
      logger.info("downloadRemoveBgJobOutput::deleted", {
        requestId: httpRequestId,
        jobRequestId: job.request_id,
        reason,
        filename,
      });
    } catch (err: any) {
      // It's OK if it was already deleted, but log other errors.
      const code = String(err?.code || "");
      if (code !== "ENOENT") {
        logger.warn("downloadRemoveBgJobOutput::delete_failed", {
          requestId: httpRequestId,
          jobRequestId: job.request_id,
          reason,
          filename,
          message: err?.message ?? String(err),
        });
      }
    }
  };

  // If the client disconnects early, still delete to satisfy privacy policy.
  res.on("close", () => {
    if (!res.writableEnded) {
      deleteFile("client_disconnected").catch(() => {});
    }
  });

  try {
    const stat = await fsPromises.stat(filePath);
    const stream = fs.createReadStream(filePath);
    stream.on("error", async (err: any) => {
      const code = String(err?.code || "");
      if (code === "ENOENT") {
        return res.status(410).json({
          error: true,
          message: "file_gone",
          requestId: httpRequestId,
        });
      }
      logger.warn("downloadRemoveBgJobOutput::read_failed", {
        requestId: httpRequestId,
        jobRequestId: job.request_id,
        filename,
        message: err?.message ?? String(err),
      });
      return res.status(500).json({
        error: true,
        message: "read_failed",
        requestId: httpRequestId,
      });
    });

    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "no-store");

    stream.pipe(res);

    stream.on("end", () => {
      // After full delivery, delete.
      deleteFile("delivered").catch(() => {});
    });
  } catch (err: any) {
    logger.warn("downloadRemoveBgJobOutput::unhandled_error", {
      requestId: httpRequestId,
      jobRequestId: job.request_id,
      filename,
      message: err?.message ?? String(err),
    });
    return res.status(500).json({
      error: true,
      message: "internal_error",
      requestId: httpRequestId,
    });
  }
};
