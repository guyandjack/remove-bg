//import des hooks
import { useState } from "preact/hooks";

//import des librairies
import { api } from "@/utils/axiosConfig";

//import des fonctions
import { sessionSignal } from "@/stores/session";
import { updateSessionUser } from "@/utils/localstorage/updateSessionUser";

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
        // 2) Met à jour les crédits côté session
        sessionSignal.value = {
          ...sessionSignal.value,
          credits: {
            used_last_24h: data.used_last_24h,
            remaining_last_24h: data.remaining_last_24h,
          },
        };
        //Met à jour les crédits côté localStorage
        updateSessionUser("credits", {
          used_last_24h: data.used_last_24h,
          remaining_last_24h: data.remaining_last_24h,
        });

        // 3) Déclenche le téléchargement via un lien temporaire
        const link = document.createElement("a");
        link.download = "image-composed.png";
        link.href = currentSource;
        document.body.appendChild(link);
        link.click();
        link.remove();
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
