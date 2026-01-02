import type { Request, Response, NextFunction } from "express";

import { validateImageUpload } from "../checkDataUpload/checkDataUpload";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const allowedMimes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const allowedQuality = new Set(["fast", "pro"]);
const DEFAULT_QUALITY = "fast";

const validateRemoveBgUpload = validateImageUpload("file", {
  maxSizeBytes: MAX_FILE_SIZE,
  allowedMimes,
});

const attachRemoveBgQuality = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const candidate =
    (req.query?.quality as string | undefined) ??
    (req.body?.quality as string | undefined);
  const normalized = typeof candidate === "string" ? candidate.toLowerCase() : "";
  const quality = allowedQuality.has(normalized) ? normalized : DEFAULT_QUALITY;
  (req as any).removeBgOptions = {
    ...((req as any).removeBgOptions || {}),
    quality,
  };
  next();
};

export { validateRemoveBgUpload, attachRemoveBgQuality };
