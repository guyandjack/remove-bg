// UploadImg.tsx

//import des hooks
import { useEffect, useRef, useState } from "preact/hooks";
import { sessionSignal } from "@/stores/session";
import { planOptionsSignal } from "@/stores/planOptions";
import { getMaxUploadForUser } from "@/utils/planOptionLimits";
import { validateFile } from "@/utils/check/validateFileImg";

//import des composants enfant
import { InputFile } from "../input/InputFile";

//import des data





export type UploadImgType = {
  label: string;
  placeholder: string;
  filename: string;
  preview: string;
  erase: string;
  nofile: string;
  tooLarge: string;
  mustBeImage: string;
  unsupportedFormat: string;
  invalidExtension: string;
};

export type UploadImgProps = {
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  onFileReady: (file: File | null) => void;
  content: UploadImgType;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  actionsDisabled?: boolean;
};

const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const ACCEPTED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif"] as const;

const interpolateMaxMb = (template: string, maxMb: number) =>
  template.replace(/\{\{\s*maxMb\s*\}\}/g, String(maxMb));

const UploadImg = ({
  setPreviewUrl,
  previewUrl,
  onFileReady,
  content,
  onConfirm,
  confirmDisabled = false,
  confirmLabel = "Valider",
  actionsDisabled = false,
}: UploadImgProps) => {
  const [error, setError] = useState<string>("");
  const [clearSignal, setClearSignal] = useState<number>(0);
  const errorTimerRef = useRef<number | null>(null);
  const isLoged = sessionSignal.value?.authentified === true;
  const planUser = sessionSignal.value?.plan?.code || null;
  const { maxBytes, maxMb } = getMaxUploadForUser({
    plans: planOptionsSignal.value,
    isAuthenticated: isLoged,
    planCode: planUser,
  });

  
  // Nettoie l'ancienne URL de preview
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current !== null) {
        window.clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, []);

  const clearPendingErrorTimer = () => {
    if (errorTimerRef.current === null) return;
    window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = null;
  };

  const revokePreviewUrl = (url: string | null) => {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {}
  };

  const resetState = () => {
    clearPendingErrorTimer();
    revokePreviewUrl(previewUrl);
    setPreviewUrl(null);
    setError("");
    onFileReady(null);
  };

  const clearInput = () => setClearSignal((previous) => previous + 1);

  

  const onChangeFile = (file: File | null) => {
    if (!file) {
      resetState();
      return;
    }

    clearPendingErrorTimer();

    const validationContent = {
      ...content,
      tooLarge: interpolateMaxMb(content.tooLarge, maxMb),
    };
    const err = validateFile(
      file,
      validationContent,
      ACCEPTED_MIME,
      ACCEPTED_EXT,
      maxBytes,
    );
    if (err) {
      revokePreviewUrl(previewUrl);
      setPreviewUrl(null);
      onFileReady(null);
      setError(err);
      errorTimerRef.current = window.setTimeout(() => {
        clearInput();
        resetState();
      }, 3000);
      return;
    }

    setError("");

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onFileReady(file);
  };

  const onClear = () => {
    clearInput();
    resetState();
  };

  return (
    <div className="w-full">
      <form className="mx-auto max-w-xl p-6 md:p-8 rounded-xl bg-base-100/60 backdrop-blur-sm shadow-sm">
        <fieldset className="fieldset">
          <legend className="fieldset-legend text-base-content"></legend>

          <div className="space-y-3">
            <InputFile
              id="imageUpload"
              accept={ACCEPTED_MIME.join(",")}
              onChange={onChangeFile}
              className="w-full bg-base-200 file-input-info"
              placeholder={content.placeholder}
              buttonText={content.label}
              clearSignal={clearSignal}
            />
            <div className="label p-0">
              <span className="label-text text-base-content/70">
                {`Formats: JPG, PNG, WEBP, GIF - Max ${maxMb} MB`}
              </span>
            </div>

            {error && (
              <div
                className="alert alert-error py-2 text-sm"
                role="alert"
                aria-live="assertive"
              >
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between">
                {previewUrl ? (
                  <div className="flex items-center gap-2">
                    {onConfirm ? (
                      <button
                        type="button"
                        onClick={onConfirm}
                        className="btn btn-success btn-md"
                        disabled={actionsDisabled || confirmDisabled}
                      >
                        {confirmLabel}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={onClear}
                      className="btn btn-ghost btn-md"
                      disabled={actionsDisabled}
                    >
                      {content.erase}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl bg-base-200/70 p-4 ring-1 ring-base-200">
                {previewUrl ? (
                  <figure className="flex flex-col items-center gap-3">
                    <img
                      src={previewUrl}
                      alt="Apercu de l'image uploadee"
                      className="max-h-64 w-auto rounded-lg shadow-md object-contain bg-base-100"
                    />
                    {/* <figcaption className="text-xs text-base-content/60">
                      {}
                    </figcaption> */}
                  </figure>
                ) : (
                  <div className="flex h-44 items-center justify-center text-base-content/50">
                    <span className="text-sm">{content.preview}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
};

export { UploadImg };
