// UploadImg.tsx

//import des hooks
import { useEffect, useState } from "preact/hooks";
import { sessionSignal } from "@/stores/session";

//import des composants enfant
import { InputFile } from "../input/InputFile";

//import des data




const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ACCEPTED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const fileSizeUploadLimit = {
  free: 1 * 1024 * 1024,
  hobby: 5 * 1024 * 1024,
  pro: 10 * 1024 * 1024,
} as const;



export type UploadImgType = {
  label: string;
  placeholder: string;
  filename: string;
  preview: string;
  erase: string;
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
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [textSize, setTextZise] = useState<number>(5);


  const isLoged = sessionSignal.value?.authentified;
  const planUser = sessionSignal.value?.plan?.code;
  let maxBytes = 1;
  
  function getLimitSizeFile() {
    let result = fileSizeUploadLimit.hobby;
    if (!isLoged) { result = fileSizeUploadLimit.hobby };
    if (planUser === "free") { result = fileSizeUploadLimit.free };
    if (planUser === "hobby") { result = fileSizeUploadLimit.hobby };
    if (planUser === "pro") { result = fileSizeUploadLimit.pro };
    return {
      fileSize: result,
      textSize: Math.round(result / (1024 * 1024))
    } 
  }

  useEffect(() => {
    const result = getLimitSizeFile();
    setTextZise(result.textSize);
  },[])

  
  // Nettoie l'ancienne URL de preview
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resetState = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName("");
    setError("");
    onFileReady(null);
  };

  const validateFile = (file: File): string | null => {
    if (!file) return "Aucun fichier selectionne.";

    let result = getLimitSizeFile();
    

    if (file.size > result.fileSize) {
      return `Le fichier depasse ${result.textSize} Mo.`;
    }

    const isImageMime = file.type.startsWith("image/");
    if (!isImageMime) return "Le fichier doit etre une image.";
    if (!ACCEPTED_MIME.has(file.type))
      return "Format non supporte (JPEG, PNG, WEBP, GIF).";

    const lower = file.name.toLowerCase();
    const hasValidExt = Array.from(ACCEPTED_EXT).some((ext) =>
      lower.endsWith(ext)
    );
    if (!hasValidExt)
      return "Extension non valide (jpg, jpeg, png, webp, gif).";

    return null;
  };

  const onChangeFile = (file: File | null) => {
    if (!file) {
      resetState();
      return;
    }
    const err = validateFile(file);
    if (err) {
      resetState();
      setError(err);
      return;
    }

    setError("");
    setFileName(file.name);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onFileReady(file);
  };

  const onClear = () => {
    resetState();
    const input = document.getElementById(
      "imageUpload"
    ) as HTMLInputElement | null;
    if (input) {
      input.value = "";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  return (
    <div className="w-full">
      <form className="mx-auto max-w-xl p-6 md:p-8 rounded-xl bg-base-100/60 backdrop-blur-sm shadow-sm">
        <fieldset className="fieldset">
          <legend className="fieldset-legend text-base-content"></legend>

          <div className="space-y-3">
            <InputFile
              id="imageUpload"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onChangeFile}
              className="w-full bg-base-200 file-input-info"
              //placeholder={content.placeholder}
              buttonText={content.label}
            />
            <div className="label p-0">
              <span className="label-text text-base-content/70">
                {`Formats: JPG, PNG, WEBP, GIF - Max ${textSize} Mo`}
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
                <span className="text-sm text-base-content/70 truncate">
                  {fileName || content.filename}
                </span>
                {previewUrl ? (
                  <div className="flex items-center gap-2">
                    {onConfirm ? (
                      <button
                        type="button"
                        onClick={onConfirm}
                        className="btn btn-ghost btn-xs"
                        disabled={actionsDisabled || confirmDisabled}
                      >
                        {confirmLabel}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={onClear}
                      className="btn btn-ghost btn-xs"
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
                    <figcaption className="text-xs text-base-content/60">
                      Apercu
                    </figcaption>
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
