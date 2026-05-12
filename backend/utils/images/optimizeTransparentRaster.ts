import sharp from "sharp";

export type OptimizedRaster = {
  buffer: Buffer;
  contentType: "image/png";
  extension: "png";
};

function normalizeContentType(contentType: unknown): string {
  return String(contentType || "").toLowerCase().split(";")[0]?.trim();
}

/**
 * Optimise a raster image while preserving:
 * - dimensions (no resize)
 * - transparency (alpha)
 *
 * Strategy:
 * - Produce two PNG candidates:
 *   1) lossless PNG with strong compression
 *   2) palettized PNG (usually much smaller for cutouts)
 * - Keep the smallest candidate (never larger than the input when possible).
 *
 * Notes:
 * - Palettization may introduce slight banding on gradients. We only keep it
 *   when it yields a meaningful size improvement.
 */
export async function optimizeTransparentRaster(params: {
  input: Buffer;
  inputContentType?: string | null;
}): Promise<OptimizedRaster> {
  if (!Buffer.isBuffer(params.input) || params.input.length === 0) {
    throw new Error("optimizeTransparentRaster: input buffer is required");
  }

  const inputType = normalizeContentType(params.inputContentType);

  // We always output PNG to keep client compatibility and preserve alpha.
  // `rotate()` applies EXIF orientation if present without changing dimensions.
  const lossless = await sharp(params.input, { failOnError: false })
    .rotate()
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: 10,
    })
    .toBuffer();

  // Palettized PNG (quantized). Works great for background-removed images.
  // Keep only if it significantly reduces size vs lossless.
  let palettized: Buffer | null = null;
  try {
    palettized = await sharp(params.input, { failOnError: false })
      .rotate()
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        quality: 80,
        effort: 10,
      })
      .toBuffer();
  } catch {
    palettized = null;
  }

  const bestLossless = lossless.length > 0 ? lossless : params.input;
  let best = bestLossless;

  // Only accept palettization if it saves at least ~10% to avoid needless quality loss.
  if (palettized && palettized.length > 0) {
    const delta = bestLossless.length - palettized.length;
    const savesEnough = delta > 0 && delta / bestLossless.length >= 0.1;
    if (savesEnough) best = palettized;
  }

  // Defensive: never return something bigger than the original if original is already PNG-like.
  // For non-PNG inputs, we still prefer the optimized PNG even if larger (alpha + compatibility).
  const isProbablyPng = inputType === "image/png" || inputType === "";
  if (isProbablyPng && params.input.length > 0 && best.length > params.input.length) {
    best = params.input;
  }

  return { buffer: best, contentType: "image/png", extension: "png" };
}

