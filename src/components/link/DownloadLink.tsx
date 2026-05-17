//import des hooks
import { useState } from "preact/hooks";

//import des fonctions
import { setFileNameDownload } from "@/utils/setFileNameDownload";

// Le crédit est consommé au moment du traitement (Replicate), pas au téléchargement.

type FileSystemWritableFileStreamLike = {
  write: (data: Blob | BufferSource | string) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandleLike = {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
};

type SaveFilePickerOptionsLike = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
};

type WindowWithFilePicker = Window & {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptionsLike
  ) => Promise<FileSystemFileHandleLike>;
};

type DownloadLinkTextContent = {
  pending: string;
  download: string;
  noCredits: string;
  errorPrefix: string;
  invalidSource: string;
  retrieveError: string;
  fileTypeDescription: string;
};






const buildBlobFromSource = async (
  source: string,
  textContent: DownloadLinkTextContent
): Promise<Blob> => {
  if (!source) throw new Error(textContent.invalidSource);
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(textContent.retrieveError);
  }
  return await response.blob();
};

const triggerFallbackDownload = (blob: Blob, fileName: string) => {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
};

const saveImageToDestination = async (
  source: string,
  textContent: DownloadLinkTextContent,
  fileName: string,
) => {
  const blob = await buildBlobFromSource(source, textContent);
  if (typeof window === "undefined") {
    triggerFallbackDownload(blob, fileName);
    return;
  }
  const maybePicker = (window as WindowWithFilePicker).showSaveFilePicker;
  if (typeof maybePicker === "function") {
    const handle = await maybePicker({
      suggestedName: fileName,
      types: [
        {
          description: textContent.fileTypeDescription,
          accept: {
            "image/png": [".png"],
            "image/jpeg": [".jpg", ".jpeg"],
            "image/webp": [".webp"],
          },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  triggerFallbackDownload(blob, fileName);
};

type DownloadLinkProps = {
  currentSource: string; // dataURL ou URL de l'image finale
  credit: number;
  textContent: DownloadLinkTextContent;
  
};

type StatusError = "error" | "valid" | "idle";

type Message = {
  error: string;
  success: string;
};

type ObjectError = {
  status: StatusError;
  message: Message;
};

const DownloadLink = ({ currentSource, credit, textContent }: DownloadLinkProps) => {
  const [isPending, setIsPending] = useState(false);
  const [showToast, setShowToast] = useState<ObjectError>({
    status: "idle",
    message: {
      error: "",
      success: "",
    },
  });

  const handleClick = async (e:MouseEvent) => {
    // On bloque seulement si déjà en cours ou si aucune source.
    // Le solde de crédits est mis à jour après le succès Replicate.
    if (!currentSource || isPending) {
      e.preventDefault();
      return;
    }

    e.preventDefault(); // on prend le contrôle du download pour éviter les doubles appels
    setIsPending(true);

    const dowloadName = setFileNameDownload("remove-bg");

    try {
      await saveImageToDestination(currentSource, textContent, dowloadName);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        
        setShowToast({
          status: "error",
          message: {
            error: `${textContent.errorPrefix} ${String(err)}`,
            success: "",
          },
        });
      };
    } finally {
      setTimeout(() => {
        
        setIsPending(false);
        setShowToast({
          status: "idle",
          message: {
            error: "",
            success: "",
          },
        });
      }, 3000);
    }
  };

  const disabled = !currentSource || isPending;

  return (
    <div>
      {
        <button
          className={`btn btn-outline btn-success`}
          aria-disabled={disabled}
          disabled={disabled}
        >
          
          <a
            href={disabled ? "undefined" : currentSource}
            download={`remove-bg-${Date.now()*3600}.png`}
            onClick={handleClick}
          >
            {isPending ? textContent.pending : textContent.download}
          </a>
        </button>
      }
      {showToast.status !== "idle" ? (
        <div className="toast toast-center toast-middle">
          {showToast.status === "error" ? (

            <div className="alert alert-info">
              <span>{showToast.message.error}</span>
            </div>
          ) : (
            <div className="alert alert-success">
              <span>{showToast.message.success}</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export { DownloadLink };
