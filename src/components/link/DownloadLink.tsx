//import des hooks
import { useState } from "preact/hooks";

//import des librairies
import axios from "axios";

//import des fonction
import { sessionSignal, setSessionFromApiResponse } from "@/stores/session";
import { localOrProd } from "@/utils/localOrProd";
//import { axiosError } from "@/utils/axiosError";

//variable et constante globale
const { urlApi } = localOrProd();

type DownloadLinkProps = {
  currentSource: string; // dataURL ou URL de l'image finale
  credit: number;
};

type StatusError = "error" | "valid" | "idle";

type Message = {
  error: string
  success: string;
};

type ObjectError = {
  status: StatusError;
  message: Message;
}

const DownloadLink = ({ currentSource, credit }: DownloadLinkProps) => {
  const [isPending, setIsPending] = useState(false);
  const [showToast, setShowToast] = useState<ObjectError>({
    status: "idle",
    message: {
      error: "",
      success:""
    }
  });
  

  const handleClick = async (e: JSX.TargetedMouseEvent<HTMLAnchorElement>) => {
    // Si pas de crédit ou déjà en cours → on bloque direct
    if (credit < 1 || isPending) {
      e.preventDefault();
      return;
    }

    e.preventDefault(); // on prend le contrôle du download
    setIsPending(true);

    try {
      const payload = {
        reason: "download",
      };
      // 1. Appel API pour décrémenter
      const response = await axios.post(`${urlApi}/api/usage/download`, payload, {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      if (!response) {
        console.error("Erreur décrémentation crédits");
        setShowToast({
          status: "error",
          message: {
            error: "A HTTP error was occured",
            success:""
          }
       })
        return;
      }



      
      // TODO : mettre à jour ton signal global de session avec les nouveaux crédits
      // sessionSignal.value = { ...sessionSignal.value, credits: data.credits };


      // 2. Une fois l'API OK → on déclenche le téléchargement manuellement
      const link = document.createElement("a");
      link.href = currentSource;
      link.download = "image-composed.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setShowToast({
        status: "error",
        message: {
          error: `A unknow error was occured: ${err}`,
          success:""
        }
      })
      console.error("Erreur durant le clic de téléchargement :", err);
    } finally {
      setTimeout(() => {
        setIsPending(false);
        setShowToast({
          status: "idle",
          message: {
            error: "",
            success:""
          }
        })
      },2500)
    }
  };

  const disabled = credit < 1 || isPending;

  return (
    <div>
      {disabled ?
        
        <button
        className={`btn btn-outline border border-warning text-warning `}
          aria-disabled={disabled}
          disabled
        
      >
        {credit > 0
          ? isPending
            ? "En cours..."
            : "Télécharger"
          : "No more credit for today..."}
        </button>:
        <a
        className={`btn btn-outline`}
        href={disabled ? "#" :currentSource}
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
