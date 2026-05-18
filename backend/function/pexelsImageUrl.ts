type PexelsImageTransformOptions = {
  width: number;
  height: number;
};

/**
 * Construit une URL Pexels (images.pexels.com) avec des paramètres de resize/crop.
 * Pexels documente des paramètres de type imgix (auto, cs, fit, w, h) sur les URLs d'images.
 *
 * Objectif: demander une image ~2000x2000 sans étirement (crop côté CDN),
 * puis on applique un "cover" côté canvas pour respecter le ratio du sujet.
 */
function buildPexelsCroppedImageUrl(
  originalUrl: string,
  options: PexelsImageTransformOptions
): string {
  try {
    const url = new URL(originalUrl);
    url.searchParams.set("auto", "compress");
    url.searchParams.set("cs", "tinysrgb");
    url.searchParams.set("fit", "crop");
    url.searchParams.set("w", String(options.width));
    url.searchParams.set("h", String(options.height));
    return url.toString();
  } catch {
    // Fallback très conservateur si originalUrl n'est pas une URL absolue.
    const glue = originalUrl.includes("?") ? "&" : "?";
    return `${originalUrl}${glue}w=${options.width}&h=${options.height}&fit=crop&auto=compress&cs=tinysrgb`;
  }
}

export { buildPexelsCroppedImageUrl };

