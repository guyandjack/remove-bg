import type { NextFunction, Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import { z } from "zod";

import { logger } from "../../logger.js";

const MAX_REFERENCE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const allowedReferenceImageMimeTypes = new Set(["image/png", "image/jpeg"]);

const videoGenerationBodySchema = z.object({
  prompt: z.string().trim().min(10).max(1_000),
  style: z.enum(["cinematic", "kinetic", "minimal", "dynamic"]),
  duration: z.coerce.number().refine(
    (value) => [10, 20, 30, 40].includes(value),
    "La durée doit être de 10, 20, 30 ou 40 secondes.",
  ),
});

type VideoGenerationBody = z.infer<typeof videoGenerationBodySchema>;

export type ValidatedVideoGenerationRequest = VideoGenerationBody & {
  referenceImages: Array<{
    mimeType: "image/png" | "image/jpeg";
    size: number;
  }>;
};

const normalizeFiles = (
  uploaded: UploadedFile | UploadedFile[] | undefined,
): UploadedFile[] => {
  if (!uploaded) return [];
  return Array.isArray(uploaded) ? uploaded : [uploaded];
};

const sniffImageMime = (buffer: Buffer): "image/png" | "image/jpeg" | null => {
  if (buffer.length >= 8) {
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    if (isPng) return "image/png";
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }

  return null;
};

export const validateVideoGenerationRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const bodyResult = videoGenerationBodySchema.safeParse(req.body);
  if (!bodyResult.success) {
    const issues = bodyResult.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    logger.warn("validateVideoGenerationRequest::invalid_body", {
      requestId: (req as any).requestId,
      issues,
    });
    return res.status(400).json({
      status: "error",
      code: "video_generation_invalid_payload",
      message: "Les paramètres de génération vidéo sont invalides.",
      issues,
      requestId: (req as any).requestId,
    });
  }

  const files = normalizeFiles(req.files?.referenceImages as
    | UploadedFile
    | UploadedFile[]
    | undefined);
  const referenceImages: ValidatedVideoGenerationRequest["referenceImages"] = [];

  for (const file of files) {
    if (!allowedReferenceImageMimeTypes.has(file.mimetype)) {
      return res.status(415).json({
        status: "error",
        code: "video_generation_invalid_reference_image_type",
        message: "Les images de référence doivent être au format PNG ou JPEG.",
        requestId: (req as any).requestId,
      });
    }

    if (file.size > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
      return res.status(413).json({
        status: "error",
        code: "video_generation_reference_image_too_large",
        message: "Chaque image de référence doit peser au maximum 2 Mo.",
        requestId: (req as any).requestId,
      });
    }

    const sniffedMime = sniffImageMime(file.data);
    if (!sniffedMime || sniffedMime !== file.mimetype) {
      return res.status(415).json({
        status: "error",
        code: "video_generation_invalid_reference_image_content",
        message: "Le contenu d'une image de référence ne correspond pas à son type déclaré.",
        requestId: (req as any).requestId,
      });
    }

    referenceImages.push({
      mimeType: sniffedMime,
      size: file.size,
    });
  }

  (req as Request & { videoGenerationValidated?: ValidatedVideoGenerationRequest })
    .videoGenerationValidated = {
    ...bodyResult.data,
    referenceImages,
  };

  return next();
};
