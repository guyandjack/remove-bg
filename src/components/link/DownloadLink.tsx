//import des hooks
import { useState } from "preact/hooks";

//import des librairies
import { api } from "@/utils/axiosConfig";

//import des fonctions
import { sessionSignal } from "@/stores/session";
import type { CreditsAPI } from "@/stores/session";
import { updateSessionUser } from "@/utils/localstorage/updateSessionUser";

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

const DEFAULT_DOWNLOAD_NAME = "image-composed.png";

const buildBlobFromSource = async (source: string): Promise<Blob> => {
  if (!source) throw new Error("Invalid download source");
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("Unable to retrieve file data");
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

const saveImageToDestination = async (source: string) => {
  const blob = await buildBlobFromSource(source);
  if (typeof window === "undefined") {
    triggerFallbackDownload(blob, DEFAULT_DOWNLOAD_NAME);
    return;
  }
  const maybePicker = (window as WindowWithFilePicker).showSaveFilePicker;
  if (typeof maybePicker === "function") {
    const handle = await maybePicker({
      suggestedName: DEFAULT_DOWNLOAD_NAME,
      types: [
        {
          description: "Image",
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
  triggerFallbackDownload(blob, DEFAULT_DOWNLOAD_NAME);
};

type DownloadLinkProps = {
  currentSource: string; // dataURL ou URL de l'image finale
  credit: number;
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

const DownloadLink = ({ currentSource, credit }: DownloadLinkProps) => {
  const [isPending, setIsPending] = useState(false);
  const [showToast, setShowToast] = useState<ObjectError>({
    status: "idle",
    message: {
      error: "",
      success: "",
    },
  });

  const handleClick = async (e:MouseEvent) => {
    // Si pas de crédit ou déjà en cours → on bloque direct
    if (credit < 1 || isPending) {
      e.preventDefault();
      return;
    }

    e.preventDefault(); // on prend le contrôle du download pour éviter les doubles appels
    setIsPending(true);

    try {
      const payload = { reason: "download" };

      // 1) Décrémentation via API (géré par axios + refresh si 401)
      const response = await api.post(`/api/usage/download`, payload);

      if (!response) {
        throw new Error("No response from server");
      }

      const data = response.data as any;

      if (data?.status === "success") {
        const creditsPayload = data?.credits as CreditsAPI | undefined;
        if (!creditsPayload) {
          throw new Error("Missing credits payload in API response");
        }

        const updatedCredits: CreditsAPI = {
          used_last_24h: creditsPayload.used_last_24h ?? 0,
          remaining_last_24h: creditsPayload.remaining_last_24h ?? 0,
        };
        // 2) Met a jour les credits cote session
        if (sessionSignal.value) {
          sessionSignal.value = {
            ...sessionSignal.value,
            credits: updatedCredits,
          };
        }
        // Met a jour les credits cote localStorage
        updateSessionUser("credits", updatedCredits);

        await saveImageToDestination(currentSource);
      } else {
        throw new Error("Unexpected API response");
      }
    } catch (err) {
      setShowToast({
        status: "error",
        message: {
          error: `A unknow error was occured: ${err}`,
          success: "",
        },
      });
      console.error("Erreur durant le clic de téléchargement :", err);
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
      }, 2500);
    }
  };

  const disabled = credit < 1 || isPending;

  return (
    <div>
      {disabled ? (
        <button
          className={`btn btn-outline border border-error text-error `}
          aria-disabled={disabled}
          disabled
        >
          {credit > 0
            ? isPending
              ? "En cours..."
              : "Télécharger"
            : "No more crédits for download image...."}
        </button>
      ) : (
        <a
          className={`btn btn-outline`}
          href={disabled ? "#" : currentSource}
          download="image-composed.png"
          onClick={handleClick}
          aria-disabled={disabled}
        >
          {credit > 0
            ? isPending
              ? "En cours..."
              : "Télécharger"
            : "No more credit for today..."}
        </a>
      )}
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
