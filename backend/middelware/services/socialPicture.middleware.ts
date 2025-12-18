import type { NextFunction, Request, Response } from "express";
import type { FileArray, UploadedFile } from "express-fileupload";

const KEY_PATTERN = /^assets\[(\d+)\]\[(.+)\]$/;
const SUPPORTED_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 6000;
const MAX_ASSETS = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

type PartialAsset = {
  file?: UploadedFile;
  width?: string | number;
  height?: string | number;
  defaultFormat?: string;
  presetId?: string;
  network?: string;
  category?: string;
  ratio?: string;
};

export type SanitizedSocialAsset = {
  index: number;
  file: UploadedFile;
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "avif";
  presetId?: string;
  network?: string;
  category?: string;
  ratio?: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toSingleValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return typeof value === "string" ? value : value?.toString() ?? "";
};

const parseDimension = (value: unknown): number => {
  const parsed = Number(toSingleValue(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Dimension invalide");
  }
  return Math.round(clamp(parsed, MIN_DIMENSION, MAX_DIMENSION));
};

const normalizeFormat = (value?: string): "jpeg" | "png" | "webp" | "avif" => {
  const fallback = "jpeg";
  if (!value) return fallback;
  const lower = value.toLowerCase();
  if (!SUPPORTED_FORMATS.has(lower)) return fallback;
  if (lower === "jpg") return "jpeg";
  return lower as "jpeg" | "png" | "webp" | "avif";
};

const collectAssets = (
  body: Record<string, unknown>,
  files: FileArray | undefined
) => {
  const map = new Map<string, PartialAsset>();

  const ensureEntry = (index: string) => {
    if (!map.has(index)) {
      map.set(index, {});
    }
    return map.get(index)!;
  };

  Object.entries(body || {}).forEach(([key, value]) => {
    const match = KEY_PATTERN.exec(key);
    if (!match) return;
    const [, index, field] = match;
    const entry = ensureEntry(index);
    (entry as any)[field] = toSingleValue(value);
  });

  if (files) {
    Object.entries(files).forEach(([key, fileValue]) => {
      const match = KEY_PATTERN.exec(key);
      if (!match) return;
      const [, index, field] = match;
      if (field !== "file") return;
      if (Array.isArray(fileValue)) {
        throw new Error("Le champ fichier ne peut contenir plusieurs elements.");
      }
      const entry = ensureEntry(index);
      entry.file = fileValue as UploadedFile;
    });
  }

  return map;
};

const sanitizeAssets = (map: Map<string, PartialAsset>): SanitizedSocialAsset[] => {
  if (map.size === 0) {
    throw new Error("Aucun asset fourni.");
  }

  if (map.size > MAX_ASSETS) {
    throw new Error(`Maximum ${MAX_ASSETS} images par requete.`);
  }

  const entries = Array.from(map.entries()).sort(
    ([a], [b]) => Number(a) - Number(b)
  );

  return entries.map(([index, asset]) => {
    if (!asset.file) {
      throw new Error(`Image manquante pour l'index ${index}.`);
    }

    if (asset.file.size > MAX_FILE_SIZE) {
      throw new Error(
        `Le fichier ${asset.file.name} depasse la taille autorisee (${Math.floor(
          MAX_FILE_SIZE / (1024 * 1024)
        )}MB).`
      );
    }

    const width = parseDimension(asset.width);
    const height = parseDimension(asset.height);
    const format = normalizeFormat(asset.defaultFormat);

    return {
      index: Number(index),
      file: asset.file,
      width,
      height,
      format,
      presetId: asset.presetId,
      network: asset.network,
      category: asset.category,
      ratio: asset.ratio,
    };
  });
};

const parseSocialPicturePayload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const assetsMap = collectAssets(req.body ?? {}, req.files as FileArray | undefined);
    const sanitized = sanitizeAssets(assetsMap);
    (req as any).socialAssets = sanitized;
    next();
  } catch (error) {
    res.status(400).json({
      error: true,
      message:
        (error as Error).message ||
        "Les donnees envoyees ne permettent pas de traiter les images sociales.",
      requestId: (req as any).requestId,
    });
  }
};

export { parseSocialPicturePayload };
