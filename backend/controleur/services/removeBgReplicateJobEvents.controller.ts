import type { RequestHandler } from "express";

import { logger } from "../../logger.js";
import {
  getRemoveBgJobByRequestId,
  getUserByEmail,
} from "../../DB/queriesSQL/queriesSQL.js";
import {
  subscribeRemoveBgJobEvents,
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
  // SSE requires each line to be prefixed by "data: "
  for (const line of payload.split("\n")) {
    res.write(`data: ${line}\n`);
  }
  res.write("\n");
}

export const streamRemoveBgReplicateJobEvents: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const requestIdParam = String(req.params?.requestId ?? "").trim();

  const { email } =
    ((req as any).payload as { email?: string } | undefined) || {};
  if (!email) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }
  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: true, message: "Unauthorized" });
  }

  const job = await getRemoveBgJobByRequestId(requestIdParam);
  if (!job) {
    return res.status(404).json({ error: true, message: "job_not_found" });
  }
  if (!job.user_id || job.user_id !== user.id) {
    return res.status(403).json({ error: true, message: "forbidden" });
  }

  // SSE headers
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // If behind a proxy (nginx), avoid buffering.
  res.setHeader("X-Accel-Buffering", "no");

  // Flush headers ASAP (if supported)
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  // First snapshot: DB is source of truth.
  writeSseEvent(res, "snapshot", {
    requestId: job.request_id,
    status: job.status,
    outputImageUrl: job.output_image_url,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    completedAt: job.completed_at,
  });

  // In-memory pub/sub only works within a single Node process.
  // If you run multiple instances behind a load balancer (or the process restarts),
  // webhook updates might reach another instance and the client would otherwise hang forever.
  // We therefore poll the DB (source of truth) at a low frequency and push updates when detected.
  let lastFingerprint = snapshotFingerprint({
    status: job.status,
    outputImageUrl: job.output_image_url,
    errorMessage: job.error_message,
    completedAt: job.completed_at,
  });

  const unsubscribe = subscribeRemoveBgJobEvents(
    job.request_id,
    async (evt: any) => {
      try {
        const payload = (evt?.payload ?? null) as RemoveBgJobSsePayload | null;
        if (payload && payload.status && payload.status !== "unknown") {
          writeSseEvent(res, "job", payload);
          lastFingerprint = snapshotFingerprint(payload);
          if (isTerminalStatus(String(payload.status))) {
            // Give the client a brief window to receive the terminal event, then close.
            setTimeout(() => {
              try {
                res.end();
              } catch {}
            }, 1000);
          }
          return;
        }

        // Fallback: DB source of truth snapshot
        const latest = await getRemoveBgJobByRequestId(job.request_id);
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
        logger.warn("removeBgJobEvents::send_failed", {
          requestId: httpRequestId,
          jobRequestId: job.request_id,
          message: err?.message ?? String(err),
        });
      }
    },
  );

  const pollMs = 5000;
  const poll = setInterval(async () => {
    try {
      const latest = await getRemoveBgJobByRequestId(job.request_id);
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
      logger.warn("removeBgJobEvents::poll_failed", {
        requestId: httpRequestId,
        jobRequestId: job.request_id,
        message: err?.message ?? String(err),
      });
    }
  }, pollMs);

  const heartbeatMs = 25000;
  const heartbeat = setInterval(() => {
    try {
      // SSE comment line as heartbeat (ignored by EventSource).
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

  req.on("close", () => {
    close();
  });
  req.on("aborted", () => {
    close();
  });

  logger.info("removeBgJobEvents::connected", {
    requestId: httpRequestId,
    jobRequestId: job.request_id,
    userId: user.id,
  });
};
