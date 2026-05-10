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

  const unsubscribe = subscribeRemoveBgJobEvents(
    job.request_id,
    async (evt: any) => {
      try {
        const payload = (evt?.payload ?? null) as RemoveBgJobSsePayload | null;
        if (payload && payload.status && payload.status !== "unknown") {
          writeSseEvent(res, "job", payload);
          return;
        }

        // Fallback: DB source of truth snapshot
        const latest = await getRemoveBgJobByRequestId(job.request_id);
        if (!latest) return;
        writeSseEvent(res, "job", {
          requestId: latest.request_id,
          status: latest.status,
          outputImageUrl: latest.output_image_url,
          errorMessage: latest.error_message,
          createdAt: latest.created_at,
          completedAt: latest.completed_at,
        });
      } catch (err: any) {
        logger.warn("removeBgJobEvents::send_failed", {
          requestId: httpRequestId,
          jobRequestId: job.request_id,
          message: err?.message ?? String(err),
        });
      }
    },
  );

  const heartbeatMs = 25_000;
  const heartbeat = setInterval(() => {
    try {
      // SSE comment line as heartbeat (ignored by EventSource).
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {}
  }, heartbeatMs);

  const close = () => {
    try {
      clearInterval(heartbeat);
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
