// UploadPage.tsx
//import des hooks
import { useEffect, useRef, useState } from "preact/hooks";
import { sessionSignal } from "@/stores/session";

//import des composants enfants
import { UploadImg, type UploadImgType } from "@/components/form/UploadImg";
import { ImgEditor } from "@/components/imgEditor/imgEditor";
import { Loader } from "@/components/loader/Loader";

//import des fonctions
import { loadScript } from "@/utils/loadScript";
import { api } from "@/utils/axiosConfig";
import type { AxiosError } from "axios";

// CDN de l'editeur
const editorCdn =
  "https://scaleflex.cloudimg.io/v7/plugins/filerobot-image-editor/latest/filerobot-image-editor.min.js";

type PropsPage = {
  removeTextContent: Record<string, string>;
  uploadTextContent: UploadImgType;
};

const RemoveBg = ({ removeTextContent, uploadTextContent }: PropsPage) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileToProcess, setFileToProcess] = useState<File | null>(null);
  const [responseApi, setResponseApi] = useState<string>("");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isCdnLoaded, setCdnLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [typePlan, setTypePlan] = useState<string>(
    sessionSignal?.value?.plan?.code ||
      sessionSignal?.value?.plan?.name ||
      ""
  );

  const userLoged = sessionSignal?.value?.authentified;

  const planChoiceEl = useRef<HTMLUListElement | null>(null);
  const objectSession: string = localStorage.getItem("session") || "";
  let creditRemaining = 0;
  if (objectSession !== "") {
    const objectSessionParsed = JSON.parse(objectSession);
    const localCredits = objectSessionParsed.credits.remaining_last_24h;
    creditRemaining =
      sessionSignal?.value?.credits?.remaining_last_24h || localCredits;
  }

  const choicePlan = (e?: MouseEvent) => {
    const elementList = planChoiceEl?.current;
    //si pas d'event et pas de plan c'est option de style par defaut
    if (!e && typePlan === "" && elementList) {
      const buttons =
        Array.from(elementList?.querySelectorAll("button")) || null;
      buttons.forEach((btn) => {
        btn.classList.remove("opacity-[1]");
        btn.style.outline = "none";
      });
      buttons[2].classList.add("opacity-[1]");
      buttons[2].style.outline = "dashed red";
      return;
    }

    if (elementList) {
      const buttons =
        Array.from(elementList?.querySelectorAll("button")) || null;
      buttons.forEach((btn) => {
        btn.classList.remove("opacity-[1]");
        btn.style.outline = "none";
      });
      const el = e?.currentTarget as HTMLElement | null;
      if (!el) return;

      const plan = el.dataset.plan?.trim();
      if (!plan) return;

      el.classList.add("opacity-[1]");
      el.style.outline = "dashed red";
      setTypePlan(plan);
    }
  };

  const revokeIfBlobUrl = (url: string | null) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === "string") {
          resolve(result);
        } else {
          reject(new Error("Impossible de convertir le blob en DataURL"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  // Lance le traitement des que l'utilisateur a choisi un fichier
  useEffect(() => {
    if (!fileToProcess) return;

    let isCancelled = false;
    const abortController = new AbortController();

    const ensureEditor = isCdnLoaded
      ? Promise.resolve()
      : loadScript(editorCdn).then(() => {
          setCdnLoaded(true);
        });

    const processImage = async () => {
      const formData = new FormData();
      formData.append("file", fileToProcess);

      const { data } = await api.post<Blob>(
        "api/services/remove-bg",
        formData,
        {
          responseType: "blob",
          signal: abortController.signal,
          timeout: 30000,
          }
      );

      return blobToDataUrl(data);
    };

    setIsProcessing(true);
    setProcessingError(null);

    const apiPromise = processImage().then((processedUrl) => {
      if (isCancelled) {
        revokeIfBlobUrl(processedUrl);
        return;
      }
      setResponseApi((previous) => {
        revokeIfBlobUrl(previous);
        return processedUrl;
      });
    });

    Promise.all([ensureEditor, apiPromise])
      .catch((err) => {
        if (isCancelled) return;
        const axiosError = err as AxiosError<{ message?: string }>;
        console.error("Erreur pendant chargement editeur ou API :", err);
        const message =
          axiosError.response?.data?.message ||
          axiosError.message ||
          "Impossible de traiter cette image pour le moment.";
        setProcessingError(message);
        setResponseApi((previous) => {
          revokeIfBlobUrl(previous);
          return "";
        });
      })
      .finally(() => {
        if (!isCancelled) {
          setIsProcessing(false);
        }
      });

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [fileToProcess]);

  //si un utilisateur est connecte
  // Image editor sera remonte avec la valeur du plan de l'utilisateur connecte
  useEffect(() => {
    if (!userLoged) return;
    setTypePlan(sessionSignal?.value?.plan?.code || "");
  }, [sessionSignal?.value?.plan?.code, userLoged]);

  useEffect(() => {
    return () => {
      revokeIfBlobUrl(responseApi);
    };
  }, [responseApi]);

  const shouldShowEditor =
    isCdnLoaded &&
    responseApi !== "" &&
    previewUrl !== null &&
    !isProcessing &&
    !processingError;

  //style par defaut de l' element planChoice
  useEffect(() => {
    if (!planChoiceEl?.current) return;
    choicePlan();
  }, [shouldShowEditor]);

  //scroll sur l' element principal
  useEffect(() => {
    if (!shouldShowEditor) return;
    if (planChoiceEl.current) {
      planChoiceEl.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  }, [shouldShowEditor]);

  const handleFileReady = (file: File | null) => {
    if (!file) {
      setFileToProcess(null);
      setProcessingError(null);
      setResponseApi((previous) => {
        revokeIfBlobUrl(previous);
        return "";
      });
      return;
    }
    setFileToProcess(file);
    setProcessingError(null);
    setResponseApi((previous) => {
      revokeIfBlobUrl(previous);
      return "";
    });
  };

  return (
    <div className="w-full">
      <div
        className={
          "relative w-full py-[50px] px-[10px] flex flex-col justify-start items-center gap-[30px]"
        }
      >
        <UploadImg
          setPreviewUrl={setPreviewUrl}
          previewUrl={previewUrl}
          onFileReady={handleFileReady}
          content={uploadTextContent}
        />

        {processingError && (
          <div className="alert alert-error mt-4 max-w-xl">
            <span>{processingError}</span>
          </div>
        )}
      </div>
      {!userLoged && shouldShowEditor ? (
        <ul
          ref={planChoiceEl}
          className={
            "w-full flex flex-col justify-start items-center gap-3 lg:flex-row lg:gap-5"
          }
        >
          <li>
            Simule un abonement et evalue les outils de retouche que tu
            souhaites
          </li>
          <li>
            <button
              data-plan="free"
              className={"btn btn-secondary opacity-[0.6]"}
              onClick={(e) => choicePlan(e)}
            >
              Free plan
            </button>
          </li>
          <li>
            <button
              data-plan="hobby"
              className={"btn btn-success opacity-[0.6]"}
              onClick={(e) => choicePlan(e)}
            >
              Hobby plan
            </button>
          </li>
          <li>
            <button
              data-plan="pro"
              className={"btn btn-info opacity-[0.6]"}
              onClick={(e) => choicePlan(e)}
            >
              Pro plan
            </button>
          </li>
        </ul>
      ) : null}
      <div id="editor" className="mt-6 lg:grow pb-[200px]">
        {shouldShowEditor && (
          <ImgEditor
            src={responseApi}
            planUser={typePlan}
            credit={creditRemaining}
          />
        )}

        {isProcessing && <Loader top="0px" text="is processing..." />}
      </div>
    </div>
  );
};

export { RemoveBg };
