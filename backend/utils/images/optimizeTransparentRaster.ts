import sharp from "sharp";

export type OptimizedRaster = {
  buffer: Buffer;
  contentType: "image/png";
  extension: "png";
};

function normalizeContentType(contentType: unknown): string {
  return String(contentType || "").toLowerCase().split(";")[0]?.trim();
}

function getSkipLargePngBytesThreshold(): number {
  const raw = String(process.env.SKIP_PNG_OPTIMIZE_OVER_BYTES ?? "").trim();
  if (!raw) return 8_000_000; // default: 8MB
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 8_000_000;
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

  // Performance guard:
  // Replicate often returns PNGs that are already large and reasonably compressed.
  // Re-encoding huge PNGs can take many seconds for marginal size gains.
  // For very large PNG inputs, prefer returning the input as-is.
  if (inputType === "image/png") {
    const threshold = getSkipLargePngBytesThreshold();
    if (params.input.length >= threshold) {
      return { buffer: params.input, contentType: "image/png", extension: "png" };
    }
  }

  // We always output PNG to keep client compatibility and preserve alpha.
  // `rotate()` applies EXIF orientation if present without changing dimensions.
  //
  // IMPORTANT (performance):
  // In sharp, setting `effort` or `quality` implies palette/quantization work (slow).
  // Keep this "lossless" candidate truly full-colour and fast: no `effort`, no `quality`.
  const lossless = await sharp(params.input, { failOnError: false })
    .rotate()
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false,
    })
    .toBuffer();

  // Palettized PNG (quantized). Works great for background-removed images.
  // Keep only if it significantly reduces size vs lossless.
  let palettized: Buffer | null = null;
  try {
    // Heuristic: palette PNG can be slow on very large images. Keep it bounded.
    const meta = await sharp(params.input, { failOnError: false })
      .rotate()
      .metadata();
    const pixels =
      typeof meta.width === "number" && typeof meta.height === "number"
        ? meta.width * meta.height
        : null;
    const shouldTryPalette = pixels == null ? true : pixels <= 10_000_000; // ~10MP

    if (shouldTryPalette) {
      palettized = await sharp(params.input, { failOnError: false })
        .rotate()
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true,
          quality: 80,
          effort: 6,
        })
        .toBuffer();
    } else {
      palettized = null;
    }
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
