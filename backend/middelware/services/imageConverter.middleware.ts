import type { Request, Response, NextFunction } from "express";

import { validateImageUpload } from "../checkDataUpload/checkDataUpload.js";
import {
  parseOptionsPayload,
  type NormalizedConverterOptions,
} from "../../utils/imageConverterOptions.js";
import { logger } from "../../logger.js";

const allowedMimes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const validateConverterUpload = validateImageUpload("file", {
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
    logger.warn("validateConverterOptions::invalid_options", {
      code: "mw_imageConverter_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      error,
    });
    return res.status(400).json({
      error: true,
      message: "Les parametres de conversion sont invalides.",
      code: "mw_imageConverter_err1",
      requestId: (req as any).requestId,
    });
  }
};

export { validateConverterUpload, validateConverterOptions };

