import { useEffect, useState } from "preact/hooks";

// Taille max 2 Mo
const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ACCEPTED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const UploadImg = ({setPreviewUrl, previewUrl}) => {
  //const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");

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
  };

  const validateFile = (file: File): string | null => {
    if (!file) return "Aucun fichier sélectionné.";
    if (file.size > MAX_SIZE_BYTES) return "Le fichier dépasse 2 Mo.";

    // Vérif MIME
    const isImageMime = file.type.startsWith("image/");
    if (!isImageMime) return "Le fichier doit être une image.";
    if (!ACCEPTED_MIME.has(file.type)) return "Format non supporté (JPEG, PNG, WEBP, GIF).";

    // Vérif extension
    const lower = file.name.toLowerCase();
    const hasValidExt = Array.from(ACCEPTED_EXT).some((ext) => lower.endsWith(ext));
    if (!hasValidExt) return "Extension non valide (jpg, jpeg, png, webp, gif).";

    return null;
  };

  const onChangeFile = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      resetState();
      return;
    }

    const file = files[0];
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
    
  };

  const onClear = () => {
    // Réinitialise l'état (l'input file sera réinitialisé via key sur le composant si besoin)
    resetState();
    const input = document.getElementById("imageUpload") as HTMLInputElement | null;
    if (input) input.value = "";
  };

  return (
    <div className="w-full">
      <form className="mx-auto max-w-xl p-6 md:p-8 rounded-xl bg-base-100/60 backdrop-blur-sm shadow-sm">
        <fieldset className="fieldset">
          <legend className="fieldset-legend text-base-content">Téléverser une image</legend>

          <div className="space-y-3">
            <input
              id="imageUpload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onChangeFile}
              className="file-input file-input-bordered file-input-primary w-full bg-base-200 text-base-content"
              aria-invalid={error ? true : undefined}
            />
            <div className="label p-0">
              <span className="label-text text-base-content/70">Formats: JPG, PNG, WEBP, GIF • Max 2 Mo</span>
            </div>

            {error && (
              <div className="alert alert-error py-2 text-sm" role="alert" aria-live="assertive">
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-base-content/70 truncate">{fileName || "Aucun fichier sélectionné"}</span>
                {previewUrl && (
                  <button type="button" onClick={onClear} className="btn btn-ghost btn-xs">
                    Effacer
                  </button>
                )}
              </div>

              <div className="rounded-xl bg-base-200/70 p-4 ring-1 ring-base-200">
                {previewUrl ? (
                  <figure className="flex flex-col items-center gap-3">
                    <img
                      src={previewUrl}
                      alt="Aperçu de l'image uploadée"
                      className="max-h-64 w-auto rounded-lg shadow-md object-contain bg-base-100"
                    />
                    <figcaption className="text-xs text-base-content/60">Aperçu</figcaption>
                  </figure>
                ) : (
                  <div className="flex h-44 items-center justify-center text-base-content/50">
                    <span className="text-sm">Aucun aperçu disponible</span>
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

export { UploadImg }
