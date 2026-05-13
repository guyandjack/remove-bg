import type { RequestHandler } from "express";

import { logger } from "../../logger.js";
import { getRemoveBgVisitorJobByRequestId } from "../../DB/queriesSQL/queriesSQL.js";
import {
  subscribeRemoveBgJobEventsChannel,
  type RemoveBgJobSsePayload,
} from "../../services/removeBgJobs/removeBgJobEvents.js";

function isTerminalStatus(status: string): boolean {
  const value = String(status || "").toLowerCase();
  return value === "succeeded" || value === "failed" || value === "canceled";
}

function snapshotFingerprint(snap: {
  status: unknown;
  outputImageUrl: unknown;
  errorMessage: unknown;
  completedAt?: unknown;
}): string {
  const status = String(snap.status ?? "");
  const output = snap.outputImageUrl == null ? "" : String(snap.outputImageUrl);
  const error = snap.errorMessage == null ? "" : String(snap.errorMessage);
  let completedAt = "";
  if (snap.completedAt != null) {
    const d = new Date(String(snap.completedAt));
    if (Number.isFinite(d.getTime())) completedAt = d.toISOString();
  }
  return `${status}::${output}::${error}::${completedAt}`;
}

function writeSseEvent(res: any, event: string, data: any) {
  const payload = JSON.stringify(data ?? null);
  res.write(`event: ${event}\n`);
  for (const line of payload.split("\n")) {
    res.write(`data: ${line}\n`);
  }
  res.write("\n");
}

function requireToken(req: any): string | null {
  const fromQuery = String(req.query?.token ?? "").trim();
  return fromQuery ? fromQuery : null;
}

export const streamRemoveBgVisitorReplicateJobEvents: RequestHandler = async (req, res) => {
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
    return res.status(404).json({ error: true, message: "job_not_found" });
  }
  if (String(job.access_token || "") !== token) {
    return res.status(403).json({ error: true, message: "forbidden" });
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  writeSseEvent(res, "snapshot", {
    requestId: job.request_id,
    status: job.status,
    outputImageUrl: job.output_image_url,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  });

  let lastFingerprint = snapshotFingerprint({
    status: job.status,
    outputImageUrl: job.output_image_url,
    errorMessage: job.error_message,
    completedAt: job.completed_at,
  });

  const channel = `visitor:${job.request_id}`;
  const unsubscribe = subscribeRemoveBgJobEventsChannel(channel, async (evt: any) => {
    try {
      const payload = (evt?.payload ?? null) as RemoveBgJobSsePayload | null;
      if (payload && payload.status && payload.status !== "unknown") {
        writeSseEvent(res, "job", payload);
        lastFingerprint = snapshotFingerprint(payload);
        if (isTerminalStatus(String(payload.status))) {
          setTimeout(() => {
            try {
              res.end();
            } catch {}
          }, 1000);
        }
        return;
      }

      const latest = await getRemoveBgVisitorJobByRequestId(job.request_id);
      if (!latest) return;
      const nextPayload = {
        requestId: latest.request_id,
        status: latest.status,
        outputImageUrl: latest.output_image_url,
        errorMessage: latest.error_message,
        createdAt: latest.created_at,
        completedAt: latest.completed_at,
      };
      writeSseEvent(res, "job", nextPayload);
      lastFingerprint = snapshotFingerprint(nextPayload);
      if (isTerminalStatus(String(nextPayload.status))) {
        setTimeout(() => {
          try {
            res.end();
          } catch {}
        }, 1000);
      }
    } catch (err: any) {
      logger.warn("removeBgVisitorJobEvents::send_failed", {
        requestId: httpRequestId,
        jobRequestId: job.request_id,
        message: err?.message ?? String(err),
      });
    }
  });

  const pollMs = 5000;
  const poll = setInterval(async () => {
    try {
      const latest = await getRemoveBgVisitorJobByRequestId(job.request_id);
      if (!latest) return;
      const nextPayload = {
        requestId: latest.request_id,
        status: latest.status,
        outputImageUrl: latest.output_image_url,
        errorMessage: latest.error_message,
        createdAt: latest.created_at,
        completedAt: latest.completed_at,
      };
      const fp = snapshotFingerprint(nextPayload);
      if (fp === lastFingerprint) return;
      lastFingerprint = fp;
      writeSseEvent(res, "job", nextPayload);
      if (isTerminalStatus(String(nextPayload.status))) {
        setTimeout(() => {
          try {
            res.end();
          } catch {}
        }, 1000);
      }
    } catch (err: any) {
      logger.warn("removeBgVisitorJobEvents::poll_failed", {
        requestId: httpRequestId,
        jobRequestId: job.request_id,
        message: err?.message ?? String(err),
      });
    }
  }, pollMs);

  const heartbeatMs = 25000;
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {}
  }, heartbeatMs);

  const close = () => {
    try {
      clearInterval(heartbeat);
      clearInterval(poll);
      unsubscribe();
    } catch {}
  };

  req.on("close", close);
  req.on("aborted", close);

  logger.info("removeBgVisitorJobEvents::connected", {
    requestId: httpRequestId,
    jobRequestId: job.request_id,
  });
};

