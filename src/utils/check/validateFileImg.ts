
export type FileValidationTextContent = {
  nofile: string;
  tooLarge: string;
  mustBeImage: string;
  unsupportedFormat: string;
  invalidExtension: string;
};

const normalizeExtension = (ext: string): string => {
  const trimmed = ext.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
};

const mimeMatches = (mime: string, accepted: readonly string[]): boolean => {
  for (const pattern of accepted) {
    if (!pattern) continue;
    if (pattern === mime) return true;
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      if (mime.startsWith(prefix)) return true;
    }
  }
  return false;
};

const validateFile = (
  file: File | null | undefined,
  textContent: FileValidationTextContent,
  acceptedMime: readonly string[],
  acceptedExtensions: readonly string[],
  maxSize: number,
): string | null => {
  if (!file) return textContent.nofile;

  if (Number.isFinite(maxSize) && maxSize > 0 && file.size > maxSize) {
    return textContent.tooLarge;
  }

  const expectsImage = acceptedMime.some(
    (pattern) => pattern === "image/*" || pattern.startsWith("image/"),
  );
  const mime = file.type || "";
  if (mime) {
    if (expectsImage && !mime.startsWith("image/")) return textContent.mustBeImage;
    if (acceptedMime.length > 0 && !mimeMatches(mime, acceptedMime)) {
      return textContent.unsupportedFormat;
    }
  }

  if (acceptedExtensions.length > 0) {
    const normalizedExt = acceptedExtensions
      .map(normalizeExtension)
      .filter(Boolean);
    if (normalizedExt.length > 0) {
      const lowerName = file.name.toLowerCase();
      const hasValidExt = normalizedExt.some((ext) => lowerName.endsWith(ext));
      if (!hasValidExt) return textContent.invalidExtension;
    }
  }

  return null;
};

export { validateFile };
