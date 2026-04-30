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
import { isAuthentified } from "@/utils/request/isAuthentified";
import { blobCache } from "@/utils/storage/blobCache";

// CDN de l'editeur
const editorCdn =
  "https://scaleflex.cloudimg.io/v7/plugins/filerobot-image-editor/latest/filerobot-image-editor.min.js";

type PropsPage = {
  removeTextContent: {
    confirmLabelIdle: string;
    confirmLabelProcessing: string;
    planSimulation: string;
    planFree: string;
    planHobby: string;
    planPro: string;
    loaderProcessing: string;
    defaultProcessingError: string;
  };
  uploadTextContent: UploadImgType;
  imgEditorTextContent: {
    title: string;
    tabColorPicker: string;
    tabImagePicker: string;
    resetBackground: string;
    restrictedOption: string;
    imageSearchIntro: string;
    imageSearchPlaceholder: string;
    imageSearchAriaLabel: string;
    imageSearchButton: string;
    imageSearchLoading: string;
    imageSearchError: string;
    imageRoyaltyFreeLabel: string;
    paginationPrev: string;
    paginationNext: string;
    paginationPageLabel: string;
    paginationPageEmpty: string;
    backgroundAlt: string;
    previewTitle: string;
    previewDescription: string;
    previewAlt: string;
    previewError: string;
    previewRetry: string;
    previewCancel: string;
    previewConfirm: string;
    eraserCancel: string;
    eraserRetry: string;
    eraserClearMask: string;
    eraserConfirmMask: string;
    eraserProcessing: string;
    eraserApplyToEditor: string;
    eraserResultIntro: string;
    eraserResultAlt: string;
    eraserDrawIntro: string;
    eraserZoneAlt: string;
  };
  downloadLinkTextContent: {
    pending: string;
    download: string;
    noCredits: string;
    errorPrefix: string;
    invalidSource: string;
    retrieveError: string;
    fileTypeDescription: string;
  };
};

const RemoveBg = ({
  removeTextContent,
  uploadTextContent,
  imgEditorTextContent,
  downloadLinkTextContent,
}: PropsPage) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
  const parsedSession =
    objectSession !== ""
      ? (() => {
          try {
            return JSON.parse(objectSession);
          } catch {
            return null;
          }
        })()
      : null;
  let creditRemaining = 0;
  if (parsedSession) {
    const localCredits = parsedSession?.credits?.remaining_last_24h ?? 0;
    creditRemaining =
      sessionSignal?.value?.credits?.remaining_last_24h ?? localCredits;
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

  const blobToObjectUrl = (blob: Blob): string => URL.createObjectURL(blob);

  // Restore last processed image for UX (no backend storage).
  useEffect(() => {
    let mounted = true;
    blobCache
      .get("removebg_processed")
      .then((record) => {
        if (!mounted || !record?.blob) return;
        const url = blobToObjectUrl(record.blob);
        setResponseApi((previous) => {
          revokeIfBlobUrl(previous);
          return url;
        });
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // When restoring an existing result (or after processing), ensure the editor CDN is available.
  useEffect(() => {
    if (!responseApi || isCdnLoaded) return;
    let cancelled = false;
    loadScript(editorCdn)
      .then(() => {
        if (!cancelled) setCdnLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [responseApi, isCdnLoaded]);

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

      const response = await api.post<Blob>(
        "api/services/remove-bg-replicate",
        formData,
        {
          responseType: "blob",
          signal: abortController.signal,
          timeout: 30000,
          }
      );

      // Persist processed image (IndexedDB) to avoid re-running prediction on navigation.
      try {
        await blobCache.set("removebg_processed", response.data);
      } catch {}

      const remaining = Number(response.headers?.["x-wizpix-credits-remaining"]);
      const used = Number(response.headers?.["x-wizpix-credits-used"]);
      if (Number.isFinite(remaining) && Number.isFinite(used) && sessionSignal.value) {
        const updated = {
          ...sessionSignal.value,
          credits: { used_last_24h: used, remaining_last_24h: remaining },
        };
        sessionSignal.value = updated;
        localStorage.setItem("session", JSON.stringify(updated));
      }

      return blobToObjectUrl(response.data);
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

      // Credits are decremented server-side only if Replicate succeeds.
      // Refresh session (credits displayed in Navbar/Dashboard) after success.
      // Don't rely on `userLoged` captured at render time: if it was false/stale,
      // we still want to refresh when a token exists.
      const token = sessionSignal?.value?.token ?? parsedSession?.token ?? null;
      if (token) {
        isAuthentified().catch((err) => {
          console.warn("Unable to refresh credits after Replicate success", err);
        });
      }
    });

    Promise.all([ensureEditor, apiPromise])
      .catch((err) => {
        if (isCancelled) return;
        const axiosError = err as AxiosError<{ message?: string }>;
        console.error("Erreur pendant chargement editeur ou API :", err);
        const message =
          axiosError.response?.data?.message ||
          axiosError.message ||
          removeTextContent.defaultProcessingError;
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
    isCdnLoaded && responseApi !== "" && !isProcessing && !processingError;

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
      setSelectedFile(null);
      setFileToProcess(null);
      setProcessingError(null);
      setResponseApi((previous) => {
        revokeIfBlobUrl(previous);
        return "";
      });
      return;
    }
    setSelectedFile(file);
    setProcessingError(null);
    setResponseApi((previous) => {
      revokeIfBlobUrl(previous);
      return "";
    });
  };

  const confirmProcessing = () => {
    if (!selectedFile || isProcessing) return;
    setFileToProcess(selectedFile);
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
          onConfirm={confirmProcessing}
          confirmDisabled={!selectedFile || isProcessing}
          confirmLabel={
            isProcessing
              ? removeTextContent.confirmLabelProcessing
              : removeTextContent.confirmLabelIdle
          }
          actionsDisabled={isProcessing}
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
            {removeTextContent.planSimulation}
          </li>
          <li>
            <button
              data-plan="free"
              className={"btn btn-secondary opacity-[0.6]"}
              onClick={(e) => choicePlan(e)}
            >
              {removeTextContent.planFree}
            </button>
          </li>
          <li>
            <button
              data-plan="hobby"
              className={"btn btn-success opacity-[0.6]"}
              onClick={(e) => choicePlan(e)}
            >
              {removeTextContent.planHobby}
            </button>
          </li>
          {/* <li>
            <button
              data-plan="pro"
              className={"btn btn-info opacity-[0.6]"}
              onClick={(e) => choicePlan(e)}
            >
              {removeTextContent.planPro}
            </button>
          </li> */}
        </ul>
      ) : null}
      <div id="editor" className="mt-6 lg:grow pb-[200px]">
        {shouldShowEditor && (
          <ImgEditor
            src={responseApi}
            planUser={typePlan}
            credit={creditRemaining}
            textContent={imgEditorTextContent}
            downloadLinkTextContent={downloadLinkTextContent}
          />
        )}

        {isProcessing && (
          <Loader top="0px" text={removeTextContent.loaderProcessing} />
        )}
      </div>
    </div>
  );
};

export { RemoveBg };
