import type { Request, Response, NextFunction } from "express";
import type { UploadedFile } from "express-fileupload";
import { logger } from "../../logger.js";

// Types MIME autorisÃ©s
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg", // alias, normalisÃ© en image/jpeg
  "image/png",
  "image/webp",
]);

// Taille max par dÃ©faut (5 MB)
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export type ImageValidationOptions = {
  maxSizeBytes?: number;
  allowedMimes?: Set<string>;
};

export type ValidatedImage = {
  buffer: Buffer;
  size: number;
  mime: "image/jpeg" | "image/png" | "image/webp";
  originalName: string;
  extension: "jpg" | "jpeg" | "png" | "webp";
};

// ---------- Helpers sÃ©curitÃ©/validation ----------

// Nettoyage simple du nom de fichier (retire chemins)
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]+/g, " ")
    .replace(/\0/g, "")
    .trim();
}

// DÃ©duit lâ€™extension â€œclassiqueâ€ depuis un mime
function extFromMime(mime: string): ValidatedImage["extension"] {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  // Fallback â€” ne devrait pas arriver car on filtre avant
  return "jpg";
}

// DÃ©tection par â€œmagic numbersâ€ afin dâ€™Ã©viter le spoof de MIME.
// Retourne le mime â€œrÃ©elâ€ ou null si non reconnu.
function sniffMimeFromBuffer(
  buf: Buffer
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: ff d8 ... (et souvent ff d9 en fin, mais dÃ©but suffit ici)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
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

  // WebP: "RIFF"...."WEBP" (offset 0: RIFF, offset 8: WEBP)
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

// ---------- Middleware factory ----------

/**
 * CrÃ©e un middleware de validation dâ€™upload dâ€™image pour le champ donnÃ©.
 * @param fieldName Nom du champ de formulaire (ex: "image")
 * @param options  Options facultatives (taille max, mimes autorisÃ©s)
 */
export function validateImageUpload(
  fieldName: string,
  options?: ImageValidationOptions
) {
  const maxSize = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const allowed = options?.allowedMimes ?? ALLOWED_MIMES;

  return (req: Request, res: Response, next: NextFunction) => {
    const requestMeta = {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      fieldName,
      contentType: req.headers["content-type"] || null,
    };

    // VÃ©rifie la prÃ©sence du fichier via express-fileupload
    const files = (req as any).files as
      | undefined
      | Record<string, UploadedFile | UploadedFile[]>;

    if (!files || !files[fieldName]) {
      const availableFields = files ? Object.keys(files) : [];
      logger.warn("validateImageUpload::missing_file", {
        ...requestMeta,
        availableFields,
        status: 400,
      });
      return res.status(400).json({
        error: true,
        message: `Aucun fichier reÃ§u dans le champ "${fieldName}".`,
        availableFields,
        contentType: req.headers["content-type"] || null,
        requestId: (req as any).requestId,
      });
    }

    // Interdit les tableaux de fichiers â€” on attend un seul fichier
    const file = files[fieldName];
    if (Array.isArray(file)) {
      logger.warn("validateImageUpload::multiple_files", {
        ...requestMeta,
        status: 400,
      });
      return res.status(400).json({
        error: true,
        message: `Plusieurs fichiers reÃ§us pour "${fieldName}", un seul attendu.`,
        requestId: (req as any).requestId,
      });
    }

    const f: UploadedFile = file;
    const originalName = sanitizeFilename(f.name || "upload");
    const declaredMime = (f.mimetype || "").toLowerCase();

    // VÃ©rif MIME dÃ©clarÃ© dans la liste autorisÃ©e
    if (!allowed.has(declaredMime)) {
      logger.warn("validateImageUpload::unsupported_mime", {
        ...requestMeta,
        declaredMime: declaredMime || null,
        status: 415,
      });
      return res.status(415).json({
        error: true,
        message: `Type de fichier non supportÃ© (${
          declaredMime || "inconnu"
        }). AutorisÃ©s: jpeg, png, webp.`,
        requestId: (req as any).requestId,
      });
    }

    // Taille max
    if (typeof f.size !== "number" || f.size <= 0) {
      logger.warn("validateImageUpload::invalid_size", {
        ...requestMeta,
        declaredMime: declaredMime || null,
        size: typeof f.size === "number" ? f.size : null,
        status: 400,
      });
      return res.status(400).json({
        error: true,
        message: "Fichier vide ou taille invalide.",
        requestId: (req as any).requestId,
      });
    }
    if (f.size > maxSize) {
      logger.warn("validateImageUpload::too_large", {
        ...requestMeta,
        declaredMime: declaredMime || null,
        size: f.size,
        maxSize,
        status: 413,
      });
      return res.status(413).json({
        error: true,
        message: `Fichier trop volumineux. Taille max: ${Math.floor(
          maxSize / (1024 * 1024)
        )} MB.`,
        requestId: (req as any).requestId,
      });
    }

    // RÃ©cupÃ¨re le buffer binaire (express-fileupload expose .data)
    const buffer: Buffer = (f as any).data as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length !== f.size) {
      logger.warn("validateImageUpload::corrupted_buffer", {
        ...requestMeta,
        declaredMime: declaredMime || null,
        size: f.size,
        status: 400,
      });
      return res.status(400).json({
        error: true,
        message: "Fichier non lisible ou corrompu.",
        requestId: (req as any).requestId,
      });
    }

    // Sniff binaire (anti-spoof de MIME)
    const sniffed = sniffMimeFromBuffer(buffer);
    if (!sniffed) {
      logger.warn("validateImageUpload::unknown_signature", {
        ...requestMeta,
        declaredMime: declaredMime || null,
        size: f.size,
        status: 415,
      });
      return res.status(415).json({
        error: true,
        message: "Signature de fichier inconnue ou non supportÃ©e.",
        requestId: (req as any).requestId,
      });
    }

    // Normalisation: accepte image/jpg comme image/jpeg
    const normalizedMime = sniffed; // on se base sur la signature binaire !
    if (normalizedMime === "image/jpeg" && declaredMime === "image/jpg") {
      // ok
    } else if (
      normalizedMime !== declaredMime &&
      declaredMime !== "image/jpg"
    ) {
      // Si le sniff contredit le MIME dÃ©clarÃ© (hors alias jpg/jpeg) â†’ refuse
      logger.warn("validateImageUpload::mime_mismatch", {
        ...requestMeta,
        declaredMime: declaredMime || null,
        sniffedMime: sniffed,
        size: f.size,
        status: 415,
      });
      return res.status(415).json({
        error: true,
        message: `Le contenu du fichier ne correspond pas au type dÃ©clarÃ© (${declaredMime}).`,
        requestId: (req as any).requestId,
      });
    }

    // ContrÃ´les additionnels simples sur le nom
    if (originalName.length > 200) {
      logger.warn("validateImageUpload::filename_too_long", {
        ...requestMeta,
        declaredMime: declaredMime || null,
        size: f.size,
        filenameLength: originalName.length,
        status: 400,
      });
      return res.status(400).json({
        error: true,
        message: "Nom de fichier trop long.",
        requestId: (req as any).requestId,
      });
    }

    // Tout est OK â†’ on injecte une version validÃ©e/normalisÃ©e dans req
    const ext = extFromMime(normalizedMime);
    (req as any).imageValidated = {
      buffer,
      size: f.size,
      mime: normalizedMime,
      originalName,
      extension: ext,
    } as ValidatedImage;

    next();
  };
}
