import sharp from "sharp";
import type { RequestHandler } from "express";

import { logger } from "../../logger";
import type { ValidatedImage } from "../../middelware/checkDataUpload/checkDataUpload";
import type {
  NormalizedConverterOptions,
  SupportedFormat,
} from "../../utils/imageConverterOptions";

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const buildFilename = (originalName: string, format: SupportedFormat) => {
  const baseName = originalName.replace(/\.[^/.]+$/, "").toLowerCase() || "image-convertie";
  const sanitized = baseName
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  const extension = format === "jpeg" ? "jpg" : format;
  return `${sanitized || "image-convertie"}.${extension}`;
};

const convertWithSharp = async (
  inputBuffer: Buffer,
  options: NormalizedConverterOptions
) => {
  let pipeline = sharp(inputBuffer, { failOnError: false });

  const resizeOptions: sharp.ResizeOptions = {
    fit: options.keepAspect ? "inside" : "fill",
    withoutEnlargement: false,
  };

  if (options.width) resizeOptions.width = options.width;
  if (options.height) resizeOptions.height = options.height;

  if (resizeOptions.width || resizeOptions.height) {
    pipeline = pipeline.resize(resizeOptions);
  }

  const filterValues = options.filters;
  const brightnessRatio = clampNumber(filterValues.brightness / 100, 0.2, 4);
  const grayscaleRatio = clampNumber(filterValues.grayscale / 100, 0, 1);
  const saturationRatio =
    clampNumber(filterValues.saturation / 100, 0, 3) * (1 - grayscaleRatio);
  const hueRotation =
    ((filterValues.hue % 360) + 360) % 360;
  const contrastRatio = clampNumber(filterValues.contrast / 100, 0.2, 5);
  const blurSigma = clampNumber(filterValues.blur, 0, 50);

  if (
    Math.abs(brightnessRatio - 1) > 0.01 ||
    Math.abs(saturationRatio - 1) > 0.01 ||
    Math.abs(hueRotation) > 0.1
  ) {
    pipeline = pipeline.modulate({
      brightness: brightnessRatio,
      saturation: saturationRatio,
      hue: hueRotation,
    });
  }

  if (Math.abs(contrastRatio - 1) > 0.01) {
    pipeline = pipeline.linear(contrastRatio, 128 * (1 - contrastRatio));
  }

  if (grayscaleRatio > 0.95) {
    pipeline = pipeline.grayscale();
  }

  if (blurSigma >= 0.3) {
    pipeline = pipeline.blur(blurSigma);
  }

  let mimeType = "image/png";

  switch (options.format) {
    case "jpeg":
      pipeline = pipeline.jpeg({
        quality: options.quality,
        mozjpeg: true,
        chromaSubsampling: "4:4:4",
      });
      mimeType = "image/jpeg";
      break;
    case "webp":
      pipeline = pipeline.webp({
        quality: options.quality,
        smartSubsample: true,
      });
      mimeType = "image/webp";
      break;
    case "avif":
      pipeline = pipeline.avif({
        quality: options.quality,
        effort: 3,
      });
      mimeType = "image/avif";
      break;
    default:
      pipeline = pipeline.png({
        compressionLevel: Math.round((9 * (100 - options.quality)) / 100),
        adaptiveFiltering: true,
      });
      mimeType = "image/png";
  }

  const outputBuffer = await pipeline.toBuffer();
  return { buffer: outputBuffer, mimeType };
};

const imageConverter: RequestHandler = async (req, res) => {
  try {
    const imageData = (req as any).imageValidated as ValidatedImage | undefined;
    const options = (req as any).imageConverterOptions as
      | NormalizedConverterOptions
      | undefined;

    if (!imageData || !options) {
      logger.warn("Image converter middleware missing sanitized payload", {
        hasImage: Boolean(imageData),
        hasOptions: Boolean(options),
      });
      return res.status(400).json({
        message: "Requete invalide. Merci de reessayer.",
      });
    }

    const { buffer, mimeType } = await convertWithSharp(imageData.buffer, options);
    const filename = buildFilename(imageData.originalName, options.format);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    return res.status(200).send(buffer);
  } catch (error) {
    logger.error("Image conversion failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId: (req as any).requestId,
    });

    return res.status(500).json({
      message: "Impossible de convertir l'image pour le moment.",
    });
  }
};

export { imageConverter };
