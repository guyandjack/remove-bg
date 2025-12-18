import type { Request, Response, NextFunction } from "express";

import { validateImageUpload } from "../checkDataUpload/checkDataUpload";
import {
  parseOptionsPayload,
  type NormalizedConverterOptions,
} from "../../utils/imageConverterOptions";

const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25 MB

const allowedMimes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const validateConverterUpload = validateImageUpload("file", {
  maxSizeBytes: MAX_IMAGE_SIZE,
  allowedMimes,
});

const validateConverterOptions = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawOptions = req.body?.options ?? req.body;
    const sanitized = parseOptionsPayload(rawOptions);
    (req as any).imageConverterOptions = sanitized;
    next();
  } catch (error) {
    return res.status(400).json({
      error: true,
      message: "Les parametres de conversion sont invalides.",
      requestId: (req as any).requestId,
    });
  }
};

export { validateConverterUpload, validateConverterOptions };

