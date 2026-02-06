import type { Request, Response, NextFunction } from "express";
import type { UploadedFile } from "express-fileupload";

// Types MIME autorisés
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg", // alias, normalisé en image/jpeg
  "image/png",
  "image/webp",
]);

// Taille max par défaut (5 MB)
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

// ---------- Helpers sécurité/validation ----------

// Nettoyage simple du nom de fichier (retire chemins)
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]+/g, " ")
    .replace(/\0/g, "")
    .trim();
}

// Déduit l’extension “classique” depuis un mime
function extFromMime(mime: string): ValidatedImage["extension"] {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  // Fallback — ne devrait pas arriver car on filtre avant
  return "jpg";
}

// Détection par “magic numbers” afin d’éviter le spoof de MIME.
// Retourne le mime “réel” ou null si non reconnu.
function sniffMimeFromBuffer(
  buf: Buffer
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: ff d8 ... (et souvent ff d9 en fin, mais début suffit ici)
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
 * Crée un middleware de validation d’upload d’image pour le champ donné.
 * @param fieldName Nom du champ de formulaire (ex: "image")
 * @param options  Options facultatives (taille max, mimes autorisés)
 */
export function validateImageUpload(
  fieldName: string,
  options?: ImageValidationOptions
) {
  const maxSize = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const allowed = options?.allowedMimes ?? ALLOWED_MIMES;

  return (req: Request, res: Response, next: NextFunction) => {
    // Vérifie la présence du fichier via express-fileupload
    const files = (req as any).files as
      | undefined
      | Record<string, UploadedFile | UploadedFile[]>;

    if (!files || !files[fieldName]) {
      return res.status(400).json({
        error: true,
        message: `Aucun fichier reçu dans le champ "${fieldName}".`,
        requestId: (req as any).requestId,
      });
    }

    // Interdit les tableaux de fichiers — on attend un seul fichier
    const file = files[fieldName];
    if (Array.isArray(file)) {
      return res.status(400).json({
        error: true,
        message: `Plusieurs fichiers reçus pour "${fieldName}", un seul attendu.`,
        requestId: (req as any).requestId,
      });
    }

    const f: UploadedFile = file;
    const originalName = sanitizeFilename(f.name || "upload");
    const declaredMime = (f.mimetype || "").toLowerCase();

    // Vérif MIME déclaré dans la liste autorisée
    if (!allowed.has(declaredMime)) {
      return res.status(415).json({
        error: true,
        message: `Type de fichier non supporté (${
          declaredMime || "inconnu"
        }). Autorisés: jpeg, png, webp.`,
        requestId: (req as any).requestId,
      });
    }

    // Taille max
    if (typeof f.size !== "number" || f.size <= 0) {
      return res.status(400).json({
        error: true,
        message: "Fichier vide ou taille invalide.",
        requestId: (req as any).requestId,
      });
    }
    if (f.size > maxSize) {
      return res.status(413).json({
        error: true,
        message: `Fichier trop volumineux. Taille max: ${Math.floor(
          maxSize / (1024 * 1024)
        )} MB.`,
        requestId: (req as any).requestId,
      });
    }

    // Récupère le buffer binaire (express-fileupload expose .data)
    const buffer: Buffer = (f as any).data as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length !== f.size) {
      return res.status(400).json({
        error: true,
        message: "Fichier non lisible ou corrompu.",
        requestId: (req as any).requestId,
      });
    }

    // Sniff binaire (anti-spoof de MIME)
    const sniffed = sniffMimeFromBuffer(buffer);
    if (!sniffed) {
      return res.status(415).json({
        error: true,
        message: "Signature de fichier inconnue ou non supportée.",
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
      // Si le sniff contredit le MIME déclaré (hors alias jpg/jpeg) → refuse
      return res.status(415).json({
        error: true,
        message: `Le contenu du fichier ne correspond pas au type déclaré (${declaredMime}).`,
        requestId: (req as any).requestId,
      });
    }

    // Contrôles additionnels simples sur le nom
    if (originalName.length > 200) {
      return res.status(400).json({
        error: true,
        message: "Nom de fichier trop long.",
        requestId: (req as any).requestId,
      });
    }

    // Tout est OK → on injecte une version validée/normalisée dans req
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
