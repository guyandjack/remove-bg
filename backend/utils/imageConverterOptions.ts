export type SupportedFormat = "png" | "jpeg" | "webp" | "avif";

export type FilterOptions = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  grayscale: number;
  blur: number;
};

export type NormalizedConverterOptions = {
  width?: number;
  height?: number;
  keepAspect: boolean;
  format: SupportedFormat;
  quality: number;
  filters: FilterOptions;
};

type RawFilters = Partial<Record<keyof FilterOptions, number | string>>;

type RawConverterOptions = Partial<{
  width: number | string;
  height: number | string;
  keepAspect: boolean | string;
  format: string;
  quality: number | string;
  filters: RawFilters;
}>;

export const MIN_DIMENSION = 32;
export const MAX_DIMENSION = 6000;
export const SUPPORTED_FORMATS: SupportedFormat[] = [
  "png",
  "jpeg",
  "webp",
  "avif",
];

export const DEFAULT_FILTERS: FilterOptions = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  grayscale: 0,
  blur: 0,
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const parseBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
};

const normalizeFilters = (rawFilters?: RawFilters): FilterOptions => {
  const input =
    rawFilters && typeof rawFilters === "object" ? rawFilters : undefined;

  const read = (key: keyof FilterOptions, fallback: number) =>
    toNumberValue(input?.[key]) ?? fallback;

  const hue = clampNumber(read("hue", DEFAULT_FILTERS.hue), -360, 360);

  return {
    brightness: clampNumber(read("brightness", DEFAULT_FILTERS.brightness), 10, 250),
    contrast: clampNumber(read("contrast", DEFAULT_FILTERS.contrast), 10, 250),
    saturation: clampNumber(read("saturation", DEFAULT_FILTERS.saturation), 0, 300),
    hue,
    grayscale: clampNumber(read("grayscale", DEFAULT_FILTERS.grayscale), 0, 100),
    blur: clampNumber(read("blur", DEFAULT_FILTERS.blur), 0, 50),
  };
};

const getDefaultOptions = (): NormalizedConverterOptions => ({
  keepAspect: true,
  format: "png",
  quality: 90,
  filters: { ...DEFAULT_FILTERS },
});

const sanitizeDimension = (value: unknown): number | undefined => {
  const parsed = toNumberValue(value);
  if (typeof parsed !== "number") return undefined;
  return Math.round(clampNumber(parsed, MIN_DIMENSION, MAX_DIMENSION));
};

export const parseOptionsPayload = (
  rawOptions: unknown
): NormalizedConverterOptions => {
  const options = getDefaultOptions();

  if (!rawOptions) {
    return options;
  }

  let payload: RawConverterOptions = {};

  if (typeof rawOptions === "string") {
    try {
      payload = JSON.parse(rawOptions) as RawConverterOptions;
    } catch (error) {
      throw new Error("Invalid JSON payload");
    }
  } else if (typeof rawOptions === "object") {
    payload = rawOptions as RawConverterOptions;
  }

  options.width = sanitizeDimension(payload.width);
  options.height = sanitizeDimension(payload.height);
  options.keepAspect = parseBoolean(payload.keepAspect, options.keepAspect);

  const requestedFormat = (payload.format || "").toString().toLowerCase();
  if (SUPPORTED_FORMATS.includes(requestedFormat as SupportedFormat)) {
    options.format = requestedFormat as SupportedFormat;
  }

  const requestedQuality = toNumberValue(payload.quality);
  if (typeof requestedQuality === "number") {
    options.quality = Math.round(clampNumber(requestedQuality, 1, 100));
  }

  options.filters = normalizeFilters(payload.filters);

  return options;
};
