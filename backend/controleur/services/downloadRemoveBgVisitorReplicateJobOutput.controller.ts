import type { RequestHandler } from "express";
import fs from "node:fs";
import fsPromises from "node:fs/promises";

import { logger } from "../../logger.js";
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

function isSucceeded(status: unknown): boolean {
  return String(status || "").toLowerCase() === "succeeded";
}

export const downloadRemoveBgVisitorReplicateJobOutput: RequestHandler = async (
  req,
  res,
) => {
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

  const job = await getRemoveBgVisitorJobByRequestId(requestIdParam);
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

  try {
    let stat: { size: number } | null = null;
    try {
      stat = await fsPromises.stat(filePath);
    } catch (err: any) {
      const code = String(err?.code || "");
      if (code === "ENOENT") {
        return res.status(410).json({
          error: true,
          message: "file_gone",
          requestId: httpRequestId,
        });
      }
      throw err;
    }
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
      logger.warn("downloadRemoveBgVisitorJobOutput::read_failed", {
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
    res.setHeader("Content-Length", String(stat?.size ?? 0));
    res.setHeader("Cache-Control", "no-store");

    stream.pipe(res);
  } catch (err: any) {
    return res.status(500).json({
      error: true,
      message: "internal_error",
      requestId: httpRequestId,
    });
  }
};
