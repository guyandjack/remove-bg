import type { Request, Response, NextFunction } from "express";
import type { UploadedFile } from "express-fileupload";

import type { ValidatedImage } from "../checkDataUpload/checkDataUpload.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

const allowedMimes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\]+/g, " ").replace(/\0/g, "").trim();
}

function extFromMime(mime: string): ValidatedImage["extension"] {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function sniffMimeFromBuffer(
  buf: Buffer
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function parseDataUrl(input: string): { mime: string; buffer: Buffer } | null {
  if (typeof input !== "string") return null;
  if (!input.startsWith("data:")) return null;
  const commaIndex = input.indexOf(",");
  if (commaIndex < 0) return null;

  const header = input.slice(5, commaIndex); // after 'data:'
  const data = input.slice(commaIndex + 1);

  const [contentTypePart, ...params] = header.split(";");
  const contentType = (contentTypePart || "").trim().toLowerCase();
  const isBase64 = params.map((p) => p.trim().toLowerCase()).includes("base64");
  if (!isBase64) return null;

  try {
    const buffer = Buffer.from(data, "base64");
    return { mime: contentType, buffer };
  } catch {
    return null;
  }
}

function tryReadUploadedFile(
  req: Request,
  fieldName: string
): UploadedFile | null {
  const files = (req as any).files as
    | undefined
    | Record<string, UploadedFile | UploadedFile[]>;
  if (!files || !files[fieldName]) return null;
  const maybe = files[fieldName];
  if (Array.isArray(maybe)) return null;
  return maybe as UploadedFile;
}

function validateBinaryImage(
  buffer: Buffer,
  declaredMime: string,
  originalName: string
): ValidatedImage | null {
  const mimeLower = (declaredMime || "").toLowerCase();
  if (!allowedMimes.has(mimeLower)) return null;

  if (!Buffer.isBuffer(buffer) || buffer.length <= 0) return null;
  if (buffer.length > MAX_IMAGE_SIZE) return null;

  const sniffed = sniffMimeFromBuffer(buffer);
  if (!sniffed) return null;

  if (sniffed !== mimeLower && !(sniffed === "image/jpeg" && mimeLower === "image/jpg")) {
    return null;
  }

  const normalizedMime = sniffed;
  return {
    buffer,
    size: buffer.length,
    mime: normalizedMime,
    originalName: sanitizeFilename(originalName || "upload"),
    extension: extFromMime(normalizedMime),
  } as ValidatedImage;
}

/**
 * Valide le payload Magic Eraser.
 * Supporte:
 * - `multipart/form-data` avec fichiers `init_image` + `mask_image`
 * - JSON avec dataURL base64 (fallback): `image` + `mask` (ou `init_image` + `mask_image`)
 */
const validateMagicEraserPayload = (req: Request, res: Response, next: NextFunction) => {
  const initUpload = tryReadUploadedFile(req, "init_image");
  const maskUpload = tryReadUploadedFile(req, "mask_image");

  if (initUpload && maskUpload) {
    const initValidated = validateBinaryImage(
      (initUpload as any).data as Buffer,
      initUpload.mimetype,
      initUpload.name
    );
    if (!initValidated) {
      return res.status(415).json({
        error: true,
        message: 'Fichier "init_image" invalide ou non supporte.',
        requestId: (req as any).requestId,
      });
    }

    const maskValidated = validateBinaryImage(
      (maskUpload as any).data as Buffer,
      maskUpload.mimetype,
      maskUpload.name
    );
    if (!maskValidated) {
      return res.status(415).json({
        error: true,
        message: 'Fichier "mask_image" invalide ou non supporte.',
        requestId: (req as any).requestId,
      });
    }

    (req as any).magicEraserInitImage = initValidated;
    (req as any).magicEraserMaskImage = maskValidated;
    return next();
  }

  const initDataUrl =
    (typeof (req as any).body?.init_image === "string" && (req as any).body.init_image) ||
    (typeof (req as any).body?.image === "string" && (req as any).body.image) ||
    null;
  const maskDataUrl =
    (typeof (req as any).body?.mask_image === "string" && (req as any).body.mask_image) ||
    (typeof (req as any).body?.mask === "string" && (req as any).body.mask) ||
    null;

  if (!initDataUrl || !maskDataUrl) {
    return res.status(400).json({
      error: true,
      message: 'Aucun fichier recu (init_image/mask_image) et aucun dataURL (image/mask).',
      requestId: (req as any).requestId,
    });
  }

  const initParsed = parseDataUrl(initDataUrl);
  const maskParsed = parseDataUrl(maskDataUrl);
  if (!initParsed || !maskParsed) {
    return res.status(400).json({
      error: true,
      message: "Payload invalide: dataURL attendu (base64).",
      requestId: (req as any).requestId,
    });
  }

  const initValidated = validateBinaryImage(
    initParsed.buffer,
    initParsed.mime || "application/octet-stream",
    "init_image"
  );
  const maskValidated = validateBinaryImage(
    maskParsed.buffer,
    maskParsed.mime || "application/octet-stream",
    "mask_image"
  );

  if (!initValidated || !maskValidated) {
    return res.status(415).json({
      error: true,
      message: "Image/mask non supporte (formats: jpeg, png, webp).",
      requestId: (req as any).requestId,
    });
  }

  (req as any).magicEraserInitImage = initValidated;
  (req as any).magicEraserMaskImage = maskValidated;
  return next();
};

export { validateMagicEraserPayload };
