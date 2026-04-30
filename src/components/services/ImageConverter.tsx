import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { api } from "@/utils/axiosConfig";
import { sessionSignal } from "@/stores/session";

type FilterOptions = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  grayscale: number;
  blur: number;
};

type ConverterOptions = {
  width: number;
  height: number;
  keepAspect: boolean;
  format: SupportedFormat;
  quality: number;
  filters: FilterOptions;
};

type SupportedFormat = "png" | "jpeg" | "webp" | "avif";

type SubmitStatus =
  | { state: "idle"; message?: string }
  | { state: "success"; message: string }
  | { state: "error"; message: string }
  | { state: "loading"; message: string };

type ConverterTextContent = {
  headerTagline: string;
  headerTitle: string;
  headerDescription: string;
  dropzonePrompt: string;
  dropzoneButton: string;
  dimensionsTitle: string;
  dimensionsDescription: string;
  dimensionsReset: string;
  dimensionsWidth: string;
  dimensionsHeight: string;
  dimensionsLockAspect: string;
  dimensionsOriginalPrefix: string;
  formatTitle: string;
  formatDescription: string;
  formatExtension: string;
  qualityLabel: string;
  qualityPriorityWeight: string;
  qualityPriorityQuality: string;
  filtersTitle: string;
  filtersDescription: string;
  filtersReset: string;
  actionClear: string;
  actionConvert: string;
  previewTitle: string;
  previewAlt: string;
  previewEmpty: string;
  previewHint: string;
  summaryDimensions: string;
  summaryFormat: string;
  summaryQuality: string;
  changeImage: string;
  downloadConverted: string;
  deleteConverted: string;
  assetReadyPrefix: string;
  finalAlt: string;
  finalDescription: string;
  emptyConversionHint: string;
  needPlanLink: string;
  statusDeleted: string;
  statusNoFile: string;
  statusLoading: string;
  statusSuccess: string;
  statusError: string;
  statusParamsModified: string;
  previewError: string;
  filterBrightness: string;
  filterContrast: string;
  filterSaturation: string;
  filterHue: string;
  filterGrayscale: string;
  filterBlur: string;
  filterBlurHelper: string;
};




const MIN_SIZE = 32;
const MAX_SIZE = 6000;

const formatChoices: { label: string; value: SupportedFormat }[] = [
  { label: "PNG", value: "png" },
  { label: "JPEG", value: "jpeg" },
  { label: "WEBP", value: "webp" },
  { label: "AVIF", value: "avif" },
];

const defaultFilters: FilterOptions = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  grayscale: 0,
  blur: 0,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const buildFilterChain = (filters: FilterOptions) =>
  [
    `brightness(${filters.brightness}%)`,
    `contrast(${filters.contrast}%)`,
    `saturate(${filters.saturation}%)`,
    `hue-rotate(${filters.hue}deg)`,
    `grayscale(${filters.grayscale}%)`,
    `blur(${filters.blur}px)`,
  ].join(" ");

const releaseObjectUrl = (url?: string | null) => {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

const ImageConverter = ({
  converterTextContent,
}: {
  converterTextContent: ConverterTextContent;
}) => {
  const userLoged = sessionSignal?.value?.authentified;
  
  
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>(
    { width: 0, height: 0 }
  );
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<ConverterOptions>({
    width: 1024,
    height: 1024,
    keepAspect: true,
    format: "png",
    quality: 90,
    filters: { ...defaultFilters },
  });
  const [status, setStatus] = useState<SubmitStatus>({ state: "idle" });
  const [isDragActive, setDragActive] = useState(false);
  const [convertedAsset, setConvertedAsset] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [dimensionInputs, setDimensionInputs] = useState({
    width: "1024",
    height: "1024",
  });

  const updateDimensionInputs = (width: number, height: number) => {
    setDimensionInputs({
      width: width.toString(),
      height: height.toString(),
    });
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const ensureCanvas = () => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    return canvasRef.current;
  };

  useEffect(() => {
    return () => {
      releaseObjectUrl(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      releaseObjectUrl(convertedAsset?.url);
    };
  }, [convertedAsset?.url]);

  useEffect(() => {
    if (!previewUrl) {
      setImageElement(null);
      setNaturalSize({ width: 0, height: 0 });
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImageElement(img);
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      const clampedWidth = clamp(img.naturalWidth, MIN_SIZE, MAX_SIZE);
      const clampedHeight = clamp(img.naturalHeight, MIN_SIZE, MAX_SIZE);
      setOptions((prev) => ({
        ...prev,
        width: clampedWidth,
        height: clampedHeight,
      }));
      updateDimensionInputs(clampedWidth, clampedHeight);
    };
    img.src = previewUrl;

    return () => {
      img.onload = null;
    };
  }, [previewUrl]);

  const renderPreview = useCallback(() => {
    if (!imageElement) {
      setPreviewDataUrl(null);
      return;
    }

    const canvas = ensureCanvas();
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = clamp(Math.round(options.width), MIN_SIZE, MAX_SIZE);
    const height = clamp(Math.round(options.height), MIN_SIZE, MAX_SIZE);
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.filter = buildFilterChain(options.filters);
    context.drawImage(imageElement, 0, 0, width, height);

    const mime =
      options.format === "jpeg" ? "image/jpeg" : `image/${options.format}`;
    const quality =
      options.format === "jpeg" || options.format === "webp"
        ? clamp(options.quality, 1, 100) / 100
        : undefined;

    try {
      const dataUrl = canvas.toDataURL(mime, quality);
      setPreviewDataUrl(dataUrl);
    } catch (error) {
      console.error(converterTextContent.previewError, error);
      setPreviewDataUrl(null);
    }
  }, [imageElement, options, converterTextContent.previewError]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  useEffect(() => {
    if (!convertedAsset) return;
    releaseObjectUrl(convertedAsset.url);
    setConvertedAsset(null);
    setStatus({
      state: "idle",
      message: converterTextContent.statusParamsModified,
    });
  }, [
    options.width,
    options.height,
    options.format,
    options.quality,
    options.filters.brightness,
    options.filters.contrast,
    options.filters.saturation,
    options.filters.hue,
    options.filters.grayscale,
    options.filters.blur,
    previewUrl,
    converterTextContent.statusParamsModified,
  ]);

  useEffect(() => {
    setDimensionInputs({
      width: options.width.toString(),
      height: options.height.toString(),
    });
  }, [options.width, options.height]);

  const applyFile = (selected: File) => {
    releaseObjectUrl(previewUrl);
    releaseObjectUrl(convertedAsset?.url);
    setConvertedAsset(null);
    setFile(selected);
    setStatus({ state: "idle" });
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const onFileChange = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement | null;
    const picked = target?.files?.[0];
    if (picked) {
      applyFile(picked);
    }
    if (target) {
      target.value = "";
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const picked = event.dataTransfer?.files?.[0];
    if (picked) {
      applyFile(picked);
    }
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (event: DragEvent) => {
    if (event.currentTarget === event.target) {
      setDragActive(false);
    }
  };

  const handleDimensionChange = (dimension: "width" | "height", value: number) => {
    const safeValue = clamp(Number.isNaN(value) ? MIN_SIZE : value, MIN_SIZE, MAX_SIZE);
    setOptions((prev) => {
      let nextWidth = dimension === "width" ? safeValue : prev.width;
      let nextHeight = dimension === "height" ? safeValue : prev.height;

      if (prev.keepAspect && naturalSize.width && naturalSize.height) {
        const originalRatio = naturalSize.width / naturalSize.height || 1;
        if (dimension === "width") {
          nextHeight = clamp(Math.round(nextWidth / originalRatio), MIN_SIZE, MAX_SIZE);
        } else {
          nextWidth = clamp(Math.round(nextHeight * originalRatio), MIN_SIZE, MAX_SIZE);
        }
      }

      const nextOptions = {
        ...prev,
        width: nextWidth,
        height: nextHeight,
      };
      updateDimensionInputs(nextWidth, nextHeight);
      return nextOptions;
    });
  };

  const handleDimensionInput = (
    dimension: "width" | "height",
    rawValue: string
  ) => {
    setDimensionInputs((prev) => ({ ...prev, [dimension]: rawValue }));
    if (rawValue.trim() === "") return;
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    if (parsed < MIN_SIZE) return;
    handleDimensionChange(dimension, parsed);
  };

  const handleDimensionBlur = (dimension: "width" | "height") => {
    setDimensionInputs((prev) => {
      const current = prev[dimension].trim();
      if (current === "") {
        const fallback = options[dimension].toString();
        return { ...prev, [dimension]: fallback };
      }
      const parsed = Number(current);
      if (Number.isNaN(parsed)) {
        return { ...prev, [dimension]: options[dimension].toString() };
      }
      handleDimensionChange(dimension, parsed);
      return { ...prev, [dimension]: clamp(parsed, MIN_SIZE, MAX_SIZE).toString() };
    });
  };

  const toggleAspectRatio = () => {
    setOptions((prev) => ({ ...prev, keepAspect: !prev.keepAspect }));
  };

  const updateFilter = (key: keyof FilterOptions, value: number) => {
    setOptions((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: value,
      },
    }));
  };

  const resetFilters = () => {
    setOptions((prev) => ({
      ...prev,
      filters: { ...defaultFilters },
    }));
  };

  const resetSizing = () => {
    if (!naturalSize.width || !naturalSize.height) return;
    const nextWidth = clamp(naturalSize.width, MIN_SIZE, MAX_SIZE);
    const nextHeight = clamp(naturalSize.height, MIN_SIZE, MAX_SIZE);
    setOptions((prev) => ({
      ...prev,
      width: nextWidth,
      height: nextHeight,
      keepAspect: true,
    }));
    updateDimensionInputs(nextWidth, nextHeight);
  };

  const clearAll = () => {
    releaseObjectUrl(previewUrl);
    releaseObjectUrl(convertedAsset?.url);
    setFile(null);
    setPreviewUrl(null);
    setPreviewDataUrl(null);
    setConvertedAsset(null);
    setOptions({
      width: 1024,
      height: 1024,
      keepAspect: true,
      format: "png",
      quality: 90,
      filters: { ...defaultFilters },
    });
    updateDimensionInputs(1024, 1024);
    setStatus({ state: "idle" });
  };

  const IMAGE_CONVERTER_ENDPOINT = "/api/services/image-converter";

  const buildOutputFilename = () => {
    const baseName = file?.name?.replace(/\.[^/.]+$/, "") || "image-convertie";
    const extension = options.format === "jpeg" ? "jpg" : options.format;
    return `${baseName}.${extension}`;
  };

  const parseFilenameFromDisposition = (header?: string | null) => {
    if (!header) return null;
    const match = /filename="?([^"]+)"?/i.exec(header);
    return match?.[1] || null;
  };

  const downloadConverted = () => {
    if (!convertedAsset) return;
    const anchor = document.createElement("a");
    anchor.href = convertedAsset.url;
    anchor.download = convertedAsset.filename;
    anchor.click();
  };

  const deleteConvertedAsset = () => {
    if (!convertedAsset) return;
    releaseObjectUrl(convertedAsset.url);
    setConvertedAsset(null);
    setStatus({ state: "idle", message: converterTextContent.statusDeleted });
  };

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    if (!file) {
      setStatus({ state: "error", message: converterTextContent.statusNoFile });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "options",
      JSON.stringify({
        width: options.width,
        height: options.height,
        format: options.format,
        quality: options.quality,
        keepAspect: options.keepAspect,
        filters: options.filters,
      })
    );

    try {
      setStatus({ state: "loading", message: converterTextContent.statusLoading });
      const response = await api.post(IMAGE_CONVERTER_ENDPOINT, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });
      const blob = response.data as Blob;
      releaseObjectUrl(convertedAsset?.url);
      const url = URL.createObjectURL(blob);
      const filenameFromHeader = parseFilenameFromDisposition(
        response.headers?.["content-disposition"] as string | undefined
      );
      const filename = filenameFromHeader || buildOutputFilename();
      setConvertedAsset({ url, filename });
      setStatus({
        state: "success",
        message: converterTextContent.statusSuccess,
      });
    } catch (error) {
      console.error("Erreur lors de la conversion :", error);
      setStatus({
        state: "error",
        message: converterTextContent.statusError,
      });
    }
  };

  const statusColor = useMemo(() => {
    if (status.state === "success") return "text-success";
    if (status.state === "error") return "text-error";
    if (status.state === "loading") return "text-info";
    return "text-base-content/70";
  }, [status.state]);

  const filterDescriptors = useMemo(
    () => [
      {
        key: "brightness" as const,
        label: converterTextContent.filterBrightness,
        min: 50,
        max: 150,
        step: 1,
        unit: "%",
      },
      {
        key: "contrast" as const,
        label: converterTextContent.filterContrast,
        min: 50,
        max: 150,
        step: 1,
        unit: "%",
      },
      {
        key: "saturation" as const,
        label: converterTextContent.filterSaturation,
        min: 50,
        max: 200,
        step: 1,
        unit: "%",
      },
      {
        key: "hue" as const,
        label: converterTextContent.filterHue,
        min: -180,
        max: 180,
        step: 1,
        unit: "",
      },
      {
        key: "grayscale" as const,
        label: converterTextContent.filterGrayscale,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
      },
      {
        key: "blur" as const,
        label: converterTextContent.filterBlur,
        min: 0,
        max: 10,
        step: 0.1,
        unit: "px",
        helper: converterTextContent.filterBlurHelper,
      },
    ],
    [
      converterTextContent.filterBrightness,
      converterTextContent.filterContrast,
      converterTextContent.filterSaturation,
      converterTextContent.filterHue,
      converterTextContent.filterGrayscale,
      converterTextContent.filterBlur,
      converterTextContent.filterBlurHelper,
    ],
  );

  return (
    <section className="w-full max-w-[1300px] mx-auto py-12 px-4">
      <header className="text-center flex flex-col gap-2 mb-10">
        <p className="text-sm uppercase tracking-[0.3em] text-primary">
          {converterTextContent.headerTagline}
        </p>
        <h2 className="text-3xl font-semibold">
          {converterTextContent.headerTitle}
        </h2>
        <p className="text-base-content/80">
          {converterTextContent.headerDescription}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-2">
        <form className="space-y-8" onSubmit={handleSubmit}>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition ${
              isDragActive ? "border-primary bg-primary/5" : "border-base-300"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            <p className="mb-3 font-medium">
              {file ? file.name : converterTextContent.dropzonePrompt}
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {converterTextContent.dropzoneButton}
            </button>
          </div>

          <section className="bg-base-200 rounded-2xl p-5 space-y-5 shadow-sm">
            <header className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {converterTextContent.dimensionsTitle}
                </h3>
                <p className="text-sm text-base-content/70">
                  {converterTextContent.dimensionsDescription}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={resetSizing}
                disabled={!naturalSize.width}
              >
                {converterTextContent.dimensionsReset}
              </button>
            </header>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="form-control">
                <span className="label-text font-semibold">
                  {converterTextContent.dimensionsWidth}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input-clean input-sm"
                  value={dimensionInputs.width}
                  onInput={(event) =>
                    handleDimensionInput("width", event.currentTarget.value)
                  }
                  onBlur={() => handleDimensionBlur("width")}
                />
              </label>
              <label className="form-control">
                <span className="label-text font-semibold">
                  {converterTextContent.dimensionsHeight}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input-clean input-sm"
                  value={dimensionInputs.height}
                  onInput={(event) =>
                    handleDimensionInput("height", event.currentTarget.value)
                  }
                  onBlur={() => handleDimensionBlur("height")}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={options.keepAspect}
                  onChange={toggleAspectRatio}
                />
                <span className="text-sm font-medium">
                  {converterTextContent.dimensionsLockAspect}
                </span>
              </label>
              {naturalSize.width ? (
                <p className="text-xs text-base-content/60">
                  {converterTextContent.dimensionsOriginalPrefix}{" "}
                  {naturalSize.width} x {naturalSize.height}px
                </p>
              ) : null}
            </div>
          </section>

          <section className="bg-base-200 rounded-2xl p-5 space-y-5 shadow-sm">
            <header className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {converterTextContent.formatTitle}
                </h3>
                <p className="text-sm text-base-content/70">
                  {converterTextContent.formatDescription}
                </p>
              </div>
            </header>

            <label className="form-control">
              <span className="label-text font-semibold mr-[20px]">
                {converterTextContent.formatExtension}
              </span>
              <select
                className="select select-bordered select-sm"
                value={options.format}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    format: event.currentTarget.value as SupportedFormat,
                  }))
                }
              >
                {formatChoices.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control w-full">
              <div className="flex items-center justify-between">
                <span className="label-text font-semibold">
                  {converterTextContent.qualityLabel}
                </span>
                <span className="text-sm text-base-content/70">
                  {options.quality} %
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={1}
                className="range range-xs"
                value={options.quality}
                onInput={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    quality: Number(event.currentTarget.value),
                  }))
                }
              />
              <div className="flex justify-between text-xs text-base-content/60">
                <span>{converterTextContent.qualityPriorityWeight}</span>
                <span>{converterTextContent.qualityPriorityQuality}</span>
              </div>
            </label>
          </section>

          <section className="bg-base-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <header className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {converterTextContent.filtersTitle}
                </h3>
                <p className="text-sm text-base-content/70">
                  {converterTextContent.filtersDescription}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={resetFilters}
              >
                {converterTextContent.filtersReset}
              </button>
            </header>

            <div className="space-y-4">
              {filterDescriptors.map((filter) => (
                <label key={filter.key} className="form-control">
                  <div className="flex items-center justify-between">
                    <span className="label-text font-semibold">
                      {filter.label}
                    </span>
                    <span className="text-sm text-base-content/60">
                      {options.filters[filter.key]}
                      {filter.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={filter.min}
                    max={filter.max}
                    step={filter.step ?? 1}
                    className="range range-xs"
                    value={options.filters[filter.key]}
                    onInput={(event) =>
                      updateFilter(
                        filter.key,
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                  {filter.helper ? (
                    <p className="text-xs text-base-content/60 mt-1">
                      {filter.helper}
                    </p>
                  ) : null}
                </label>
              ))}
            </div>
          </section>

          <footer className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={clearAll}
              disabled={!file && !previewDataUrl}
            >
              {converterTextContent.actionClear}
            </button>
            <button
              type="submit"
              className={`btn btn-success ${
                status.state === "loading" ? "loading" : ""
              }`}
              disabled={!file || status.state === "loading"}
            >
              {converterTextContent.actionConvert}
            </button>
          </footer>
          {(status.message && status.message.length > 0) ||
          status.state !== "idle" ? (
            <p className={`text-sm ${statusColor}`}>{status.message}</p>
          ) : null}
        </form>

        <div className="relative bg-base-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
          <h3 className="text-xl font-semibold">
            {converterTextContent.previewTitle}
          </h3>
          <div className="relative w-full aspect-square bg-base-100 rounded-xl border border-base-300 flex items-center justify-center overflow-hidden">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt={converterTextContent.previewAlt}
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-center text-base-content/60 px-6">
                {converterTextContent.previewEmpty}
              </p>
            )}
          </div>
          {previewDataUrl && (
            <p className="text-sm text-base-content/70">
              {converterTextContent.previewHint}
            </p>
          )}
          <div className="bg-base-100 rounded-xl p-4 border border-base-300 space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between">
              <span className="text-base-content/70">
                {converterTextContent.summaryDimensions}
              </span>
              <span className="font-semibold">
                {options.width} x {options.height} px
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between">
              <span className="text-base-content/70">
                {converterTextContent.summaryFormat}
              </span>
              <span className="font-semibold uppercase">{options.format}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between">
              <span className="text-base-content/70">
                {converterTextContent.summaryQuality}
              </span>
              <span className="font-semibold">{options.quality}%</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 ">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {converterTextContent.changeImage}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={downloadConverted}
              disabled={!convertedAsset || !userLoged}
            >
              {converterTextContent.downloadConverted}
            </button>

            <button
              type="button"
              className="btn btn-error btn-sm btn-outline"
              onClick={deleteConvertedAsset}
              disabled={!convertedAsset}
            >
              {converterTextContent.deleteConverted}
            </button>
          </div>

          {convertedAsset ? (
            <div className="space-y-3">
              <p className="text-xs text-base-content/70">
                {converterTextContent.assetReadyPrefix}{" "}
                <span className="font-semibold">{convertedAsset.filename}</span>
              </p>
              <div className="w-full bg-base-100 rounded-xl border border-base-300 overflow-hidden">
                <img
                  src={convertedAsset.url}
                  alt={converterTextContent.finalAlt}
                  className="w-full h-auto object-contain"
                />
              </div>
              <p className="text-sm text-base-content/70">
                {converterTextContent.finalDescription}
              </p>
            </div>
          ) : (
            <p className="text-xs text-base-content/60">
              {converterTextContent.emptyConversionHint}
            </p>
          )}
          {!userLoged ? (
            <a href="/pricing" className="service-link-info">
              {converterTextContent.needPlanLink}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export { ImageConverter };
