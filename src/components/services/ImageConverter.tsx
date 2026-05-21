//import des hooks
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
//import des instances
import { planOptionsSignal } from "@/stores/planOptions";
import { sessionSignal } from "@/stores/session";
import { api } from "@/utils/axiosConfig";
import type { AxiosError } from "axios";
//import des fonctions
import { getMaxUploadForUser } from "@/utils/planOptionLimits";
import { isAuthentified } from "@/utils/request/isAuthentified";
import { setFileNameDownload } from "@/utils/setFileNameDownload";

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

function readAuthToken(): string | null {
  const raw =
    typeof window !== "undefined" ? localStorage.getItem("session") || "" : "";
  if (!raw) return sessionSignal?.value?.token ?? null;
  try {
    const parsed = JSON.parse(raw);
    return sessionSignal?.value?.token ?? parsed?.token ?? null;
  } catch {
    return sessionSignal?.value?.token ?? null;
  }
}

const ImageConverter = ({
  converterTextContent,
}: {
  converterTextContent: ConverterTextContent;
}) => {
  const userLoged = sessionSignal?.value?.authentified;
  const [visitorBlocked, setVisitorBlocked] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(
    null,
  );
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
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

  const handleDimensionChange = (
    dimension: "width" | "height",
    value: number,
  ) => {
    const safeValue = clamp(
      Number.isNaN(value) ? MIN_SIZE : value,
      MIN_SIZE,
      MAX_SIZE,
    );
    setOptions((prev) => {
      let nextWidth = dimension === "width" ? safeValue : prev.width;
      let nextHeight = dimension === "height" ? safeValue : prev.height;

      if (prev.keepAspect && naturalSize.width && naturalSize.height) {
        const originalRatio = naturalSize.width / naturalSize.height || 1;
        if (dimension === "width") {
          nextHeight = clamp(
            Math.round(nextWidth / originalRatio),
            MIN_SIZE,
            MAX_SIZE,
          );
        } else {
          nextWidth = clamp(
            Math.round(nextHeight * originalRatio),
            MIN_SIZE,
            MAX_SIZE,
          );
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
    rawValue: string,
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
      return {
        ...prev,
        [dimension]: clamp(parsed, MIN_SIZE, MAX_SIZE).toString(),
      };
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
    setVisitorBlocked(false);
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

  const IMAGE_CONVERTER_ENDPOINT = userLoged
    ? "/api/services/image-converter"
    : "/api/services/public/image-converter";

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
    const originalName = convertedAsset.filename.split(".")[0];
    const addName = setFileNameDownload("converted-at");
    anchor.download = originalName + "-" + addName;
    anchor.click();
  };

  /* const deleteConvertedAsset = () => {
    if (!convertedAsset) return;
    releaseObjectUrl(convertedAsset.url);
    setConvertedAsset(null);
    setStatus({ state: "idle", message: converterTextContent.statusDeleted });
  }; */

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    if (!file) {
      setStatus({ state: "error", message: converterTextContent.statusNoFile });
      return;
    }

    // If a token exists, verify auth before starting the conversion request.
    // This avoids starting a long request that will be rejected by the backend (expired token).
    const token = readAuthToken();
    if (token) {
      try {
        setStatus({
          state: "loading",
          message: converterTextContent.statusLoading,
        });
        await isAuthentified();
      } catch {
        setStatus({
          state: "error",
          message: "Session expirée. Merci de te reconnecter puis réessayer.",
        });
        return;
      }
    }

    // Align UX with backend upload limits (visitor/free/hobby...).
    const { maxBytes, maxMb } = getMaxUploadForUser({
      plans: planOptionsSignal.value,
      isAuthenticated: Boolean(userLoged),
      planCode: sessionSignal.value?.plan?.code || null,
    });
    if (file.size > maxBytes) {
      setStatus({
        state: "error",
        message: `Image trop volumineuse. Taille max: ${maxMb} MB.`,
      });
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
      }),
    );

    try {
      setStatus({
        state: "loading",
        message: converterTextContent.statusLoading,
      });
      const response = await api.post(IMAGE_CONVERTER_ENDPOINT, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });
      const blob = response.data as Blob;
      releaseObjectUrl(convertedAsset?.url);
      const url = URL.createObjectURL(blob);
      const filenameFromHeader = parseFilenameFromDisposition(
        response.headers?.["content-disposition"] as string | undefined,
      );
      const filename = filenameFromHeader || buildOutputFilename();
      setConvertedAsset({ url, filename });
      setStatus({
        state: "success",
        message: converterTextContent.statusSuccess,
      });
      setVisitorBlocked(false);

      // Credits are decremented server-side only on successful conversion.
      // Refresh session (credits displayed in Dashboard) after success.
      const sessionToken = sessionSignal?.value?.token ?? null;
      if (sessionToken) {
        isAuthentified().catch((err) => {
          console.warn(
            "Unable to refresh conversion credits after success",
            err,
          );
        });
      }
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      let backendMessage: string | null = null;
      let backendCode: string | null = null;

      const data = axiosError.response?.data;
      if (
        data &&
        typeof data === "object" &&
        typeof data.message === "string"
      ) {
        backendMessage = data.message;
        backendCode = typeof data.code === "string" ? data.code : null;
      } else if (data instanceof Blob) {
        // When responseType=blob, errors can still be JSON blobs.
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed.message === "string") {
            backendMessage = parsed.message;
            backendCode = typeof parsed.code === "string" ? parsed.code : null;
          }
        } catch {}
      }

      console.error("Erreur lors de la conversion :", error);
      setStatus({
        state: "error",
        message:
          backendMessage ||
          axiosError.message ||
          converterTextContent.statusError,
      });

      if (!userLoged && backendCode === "VISITOR_QUOTA_EXCEEDED") {
        setVisitorBlocked(true);
      }
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
      <header className="text-center flex flex-col gap-2 mb-20">
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

      <div className={"grid gap-10"}>
        <form
          className="flex flex-col justify-start items-center gap-4 lg:flex-row "
          onSubmit={handleSubmit}
        >
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`w-full border-2 border-dashed rounded-2xl p-6 text-center bg-component transition ${
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
              className="btn btn-outline btn-info btn-md"
              onClick={() => fileInputRef.current?.click()}
            >
              {converterTextContent.dropzoneButton}
            </button>
          </div>

          <section className="w-full flex flex-col justify-start items-left gap-4 bg-component rounded-2xl p-5  shadow-sm">
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
                className="btn btn-outline btn-info btn-sm"
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
        </form>
        <form className={"grid lg:grid-cols-2 lg:gap-4"}>
          <div
            className={
              "w-full flex flex-col justify-start items-center gap-4 lg:h-[835px]"
            }
          >
            <section className="w-full flex flex-col justify-start items-left gap-4 bg-component rounded-2xl p-5 shadow-sm">
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

            <section className="w-full flex flex-col justify-start items-left gap-4 bg-component rounded-2xl p-5 shadow-sm">
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
                  className="btn btn-outline btn-info btn-sm"
                  onClick={resetFilters}
                  disabled={!file && !previewDataUrl}
                >
                  {converterTextContent.filtersReset}
                </button>
              </header>

              <div className="flex flex-col justify-start items-left gap-4">
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

            <footer className="w-full flex flex-col gap-3 justify-start lg:flex-row bg-component p-4 rounded-xl">
                <p className={`text-sm break-words ${statusColor} lg:w-[calc(100%-220px)]`}>
                  
                {(status.message && status.message.length > 0) ||
                  status.state !== "idle" ? (
                  status.message) : ""}
                  
                </p>
               
              
              <button
                type="button"
                className="btn btn-outline btn-info btn-md w-[100px]"
                onClick={clearAll}
                disabled={!file && !previewDataUrl}
              >
                {converterTextContent.actionClear}
              </button>
              {status.state !== "loading" ? (
                <button
                  type="submit"
                  className={"btn btn-outline btn-success btn-md w-[100px]"}
                  disabled={!file || visitorBlocked}
                >
                  {converterTextContent.actionConvert}
                </button>
              ) : (
                <div className={"w-[100px] flex justify-center items-center"}>
                  <span className="loading loading-bars loading-md text-info"></span>
                </div>
              )}
            </footer>
          </div>

          <div className="relative bg-base-200 rounded-2xl p-4 shadow-sm flex flex-col justify-end gap-5 lg:h-[835px]">
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
                <span className="font-semibold uppercase">
                  {options.format}
                </span>
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
                className="btn btn-outline btn-info btn-md"
                onClick={() => fileInputRef.current?.click()}
              >
                {converterTextContent.changeImage}
              </button>

              <button
                type="button"
                className="btn btn-outline btn-success btn-md"
                onClick={downloadConverted}
                disabled={!convertedAsset}
              >
                {converterTextContent.downloadConverted}
              </button>

              {/* <button
              type="button"
              className="btn btn-outline btn-info btn-md"
              onClick={deleteConvertedAsset}
              disabled={!convertedAsset}
            >
              {converterTextContent.deleteConverted}
            </button> */}
            </div>

            {/* {convertedAsset ? (
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
          )} */}
            {/* {!userLoged ? (
            <a href="/pricing" className="service-link-info">
              {converterTextContent.needPlanLink}
            </a>
          ) : null} */}
          </div>
        </form>
      </div>
    </section>
  );
};

export { ImageConverter };
