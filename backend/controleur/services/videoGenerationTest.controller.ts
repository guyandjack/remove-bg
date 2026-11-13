import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

import type { ValidatedVideoGenerationRequest } from "../../middelware/services/videoGeneration.middleware.js";
import { logger } from "../../logger.js";

export const createVideoGenerationTest: RequestHandler = (req, res) => {
  const validated = (req as typeof req & {
    videoGenerationValidated?: ValidatedVideoGenerationRequest;
  }).videoGenerationValidated;

  if (!validated) {
    logger.error("createVideoGenerationTest::missing_validated_request", {
      requestId: (req as any).requestId,
    });
    return res.status(500).json({
      status: "error",
      code: "video_generation_validation_state_missing",
      message: "La validation de la demande vidéo est indisponible.",
      requestId: (req as any).requestId,
    });
  }

  const jobId = `video-test-${randomUUID()}`;
  logger.info("createVideoGenerationTest::accepted", {
    requestId: (req as any).requestId,
    jobId,
    style: validated.style,
    duration: validated.duration,
    referenceImageCount: validated.referenceImages.length,
  });

  return res.status(202).set("Cache-Control", "no-store").json({
    status: "accepted",
    message: "La demande de génération vidéo a été validée. Aucun rendu n'est lancé pour le moment.",
    data: {
      jobId,
      jobStatus: "validated",
      prompt: validated.prompt,
      style: validated.style,
      duration: validated.duration,
      referenceImageCount: validated.referenceImages.length,
    },
    requestId: (req as any).requestId,
  });
};
