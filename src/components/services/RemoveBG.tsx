// UploadPage.tsx
//import des hooks
import { useEffect, useRef, useState } from "preact/hooks";
import { sessionSignal } from "@/stores/session";
import { planOptionsSignal } from "@/stores/planOptions";

//import des composants enfants
import { UploadImg, type UploadImgType } from "@/components/form/UploadImg";
import { ImgEditor } from "@/components/imgEditor/imgEditor";
import { Loader } from "@/components/loader/Loader";

//import des fonctions
import { loadScript } from "@/utils/loadScript";
import { api, apiBlob } from "@/utils/axiosConfig";
import type { AxiosError } from "axios";
import { isAuthentified } from "@/utils/request/isAuthentified";
import { blobCache } from "@/utils/storage/blobCache";
import { getMaxUploadForUser } from "@/utils/planOptionLimits";

const USE_ASYNC_AUTH_FLOW = true; // easy rollback: set to false to restore blob endpoint for logged users

type RemoveBgJobStatus = "pending" | "processing" | "succeeded" | "failed" | "canceled";

type RemoveBgJobSnapshot = {
  requestId: string;
  status: RemoveBgJobStatus | string;
  outputImageUrl: string | null;
  errorMessage: string | null;
  createdAt?: string | Date | null;
  completedAt?: string | Date | null;
};

function createUuid(): string {
  try {
    // Modern browsers
    if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
      return (crypto as any).randomUUID();
    }
  } catch {}
  // Fallback: not cryptographically perfect, but keeps flow functional.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function readAuthToken(): string | null {
  const raw = localStorage.getItem("session") || "";
  if (!raw) return sessionSignal?.value?.token ?? null;
  try {
    const parsed = JSON.parse(raw);
    return sessionSignal?.value?.token ?? parsed?.token ?? null;
  } catch {
    return sessionSignal?.value?.token ?? null;
  }
}

async function openSseOverFetch(params: {
  url: string;
  token: string;
  signal: AbortSignal;
  onEvent: (evt: { event: string; data: any }) => void;
}) {
  const resp = await fetch(params.url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "text/event-stream",
    },
    signal: params.signal,
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`SSE failed: HTTP ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const flushEvent = (rawEvent: string, rawDataLines: string[]) => {
    const dataText = rawDataLines.join("\n").trim();
    if (!rawEvent && !dataText) return;
    let parsed: any = dataText;
    try {
      parsed = dataText ? JSON.parse(dataText) : null;
    } catch {}
    params.onEvent({ event: rawEvent || "message", data: parsed });
  };

  let currentEvent = "";
  let currentData: string[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE blocks separated by blank lines
    while (true) {
      const idx = buffer.indexOf("\n\n");
      if (idx === -1) break;
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = block.split("\n");
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, "");
        if (!trimmed) continue;
        if (trimmed.startsWith(":")) continue; // comment/heartbeat
        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.slice("event:".length).trim();
          continue;
        }
        if (trimmed.startsWith("data:")) {
          currentData.push(trimmed.slice("data:".length).trim());
          continue;
        }
      }

      flushEvent(currentEvent, currentData);
      currentEvent = "";
      currentData = [];
    }
  }
}

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
  const [jobStatus, setJobStatus] = useState<RemoveBgJobStatus | null>(null);
  const [jobRequestId, setJobRequestId] = useState<string | null>(null);
  const [visitorBlocked, setVisitorBlocked] = useState(false);
  const [typePlan, setTypePlan] = useState<string>(
    sessionSignal?.value?.plan?.code ||
      sessionSignal?.value?.plan?.name ||
      "free"
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
    console.log("plan type: ", typePlan);
    //si pas d'event et pas de plan c'est option de style par defaut
    if (!e && typePlan === "free" && elementList) {
      const buttons =
        Array.from(elementList?.querySelectorAll("button")) || null;
      buttons.forEach((btn) => {
        btn.classList.remove("opacity-[1]");
        btn.style.outline = "none";
      });
      buttons[0].classList.add("opacity-[1]");
      buttons[0].style.outline = "dashed red";
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

      // On ne base pas la décision uniquement sur `userLoged` (qui peut fluctuer pendant un refresh):
      // si on a un token, on utilise la route auth; sinon on utilise la route publique.
      const authToken = sessionSignal?.value?.token ?? parsedSession?.token ?? null;
      const endpoint =
        authToken && USE_ASYNC_AUTH_FLOW
          ? "api/services/remove-bg-replicate/jobs"
          : authToken
            ? "api/services/remove-bg-replicate"
            : "api/services/public/remove-bg";

      // Async (auth) flow: create job, then stream SSE updates.
      if (authToken && USE_ASYNC_AUTH_FLOW) {
        const idempotencyKey = createUuid();
        const requestId = createUuid();
        setJobRequestId(requestId);
        setJobStatus("processing");

        formData.append("idempotencyKey", idempotencyKey);
        formData.append("requestId", requestId);

        const created = await api.post(endpoint, formData, {
          headers: {
            "Idempotency-Key": idempotencyKey,
          },
          signal: abortController.signal,
          timeout: 60000,
        });

        const createdData = created?.data as any;
        const jobRequestIdFromApi = String(createdData?.requestId ?? "").trim() || requestId;
        setJobRequestId(jobRequestIdFromApi);

        const sseUrl = `${(api.defaults.baseURL || "").replace(/\/+$/, "")}/api/services/remove-bg-replicate/jobs/${encodeURIComponent(
          jobRequestIdFromApi,
        )}/events`;

        // Stream updates over fetch to keep Authorization header support.
        const sseAbortController = new AbortController();
        let terminalReached = false;
        const forwardAbort = () => {
          try {
            if (abortController.signal.aborted) sseAbortController.abort();
          } catch {}
        };
        abortController.signal.addEventListener("abort", forwardAbort, { once: true });

        await openSseOverFetch({
          url: sseUrl,
          token: authToken,
          signal: sseAbortController.signal,
          onEvent: ({ event, data }) => {
            if (isCancelled) return;
            if (event !== "snapshot" && event !== "job") return;
            const snapshot = data as RemoveBgJobSnapshot | null;
            if (!snapshot || typeof snapshot !== "object") return;

            const status = String(snapshot.status || "").toLowerCase();
            if (status) setJobStatus(status as any);

            if (status === "succeeded" && snapshot.outputImageUrl) {
              terminalReached = true;
              setResponseApi((previous) => {
                revokeIfBlobUrl(previous);
                return String(snapshot.outputImageUrl);
              });
              setProcessingError(null);
              setIsProcessing(false);
              // Refresh session/credits (async flow debits on webhook success).
              isAuthentified().catch(() => {});
              try {
                sseAbortController.abort();
              } catch {}
            }
            if (status === "failed" || status === "canceled") {
              terminalReached = true;
              setProcessingError(
                snapshot.errorMessage || removeTextContent.defaultProcessingError,
              );
              setIsProcessing(false);
              try {
                sseAbortController.abort();
              } catch {}
            }
          },
        });

        // If SSE ends without success, fall back to GET once.
        if (!terminalReached) {
          try {
            const fallback = await api.get(
              `api/services/remove-bg-replicate/jobs/${encodeURIComponent(
                jobRequestIdFromApi,
              )}`,
              { signal: abortController.signal, timeout: 20000 },
            );
            const snap = fallback?.data as RemoveBgJobSnapshot | null;
            if (snap && snap.outputImageUrl) {
              setResponseApi((previous) => {
                revokeIfBlobUrl(previous);
                return String(snap.outputImageUrl);
              });
              setProcessingError(null);
              setJobStatus(String(snap.status) as any);
              isAuthentified().catch(() => {});
            } else if (snap && (snap.status === "failed" || snap.status === "canceled")) {
              setProcessingError(
                snap.errorMessage || removeTextContent.defaultProcessingError,
              );
              setJobStatus(String(snap.status) as any);
            }
          } catch {}
        }

        // In async flow we do not return a blob URL.
        return "";
      }

      // Axios dédié aux blobs via adapter `fetch` (plus robuste que XHR sur gros fichiers).
      const response = await apiBlob.post<Blob>(endpoint, formData, {
        responseType: "blob",
        signal: abortController.signal,
        timeout: 120000,
        // Node-only en pratique, mais safe côté browser.
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onDownloadProgress: (evt) => {
          console.debug("[remove-bg] download progress", {
            loaded: evt.loaded,
            total: (evt as any).total ?? null,
          });
        },
      });

      const blob = response.data;

      // Persist processed image (IndexedDB) to avoid re-running prediction on navigation.
      try {
        await blobCache.set("removebg_processed", blob);
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

      return blobToObjectUrl(blob);
    };

    setIsProcessing(true);
    setProcessingError(null);
    setJobStatus(null);
    setJobRequestId(null);

    const apiPromise = processImage().then((processedUrl) => {
      if (isCancelled) {
        revokeIfBlobUrl(processedUrl);
        return;
      }
      if (processedUrl) {
        setResponseApi((previous) => {
          revokeIfBlobUrl(previous);
          return processedUrl;
        });
      }

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
      .catch(async (err) => {
        if (isCancelled) return;
        const axiosError = err as AxiosError<any>;
        // Si l'appel a été annulé (changement de page, nouveau fichier, etc.), on ne remonte pas d'erreur UI.
        const canceled =
          abortController.signal.aborted ||
          (axiosError as any)?.code === "ERR_CANCELED" ||
          (err as any)?.name === "AbortError" ||
          (typeof (err as any)?.message === "string" &&
            String((err as any).message).includes("BodyStreamBuffer"));
        if (canceled) return;

        // Debug minimal “Network Error” (sans données sensibles)
        // Objectif: distinguer un vrai problème réseau/CORS d’un abort/timeout/front.
        try {
          const isAxios = typeof (axiosError as any)?.isAxiosError === "boolean"
            ? (axiosError as any).isAxiosError
            : (axiosError as any)?.isAxiosError === true;
          const status = axiosError.response?.status ?? null;
          const headers = axiosError.response?.headers ?? null;
          const data = axiosError.response?.data;
          const isBlob = typeof Blob !== "undefined" && data instanceof Blob;
          const blobInfo = isBlob
            ? { size: (data as Blob).size, type: (data as Blob).type }
            : null;

          console.warn("[remove-bg] api error debug", {
            endpoint:
              (sessionSignal?.value?.token ?? parsedSession?.token ?? null)
                ? "api/services/remove-bg-replicate"
                : "api/services/public/remove-bg",
            axios: isAxios,
            code: (axiosError as any)?.code ?? null,
            message: axiosError.message ?? null,
            status,
            aborted: abortController.signal.aborted,
            timeoutMs: 120000,
            responseHeaders: headers,
            responseBlob: blobInfo,
          });
        } catch {}

        console.error("Erreur pendant chargement editeur ou API :", err);
        let message: string | null = null;
        let code: string | null = null;
        const data = axiosError.response?.data;

        if (data && typeof data === "object" && typeof data.message === "string") {
          message = data.message;
          code = typeof data.code === "string" ? data.code : null;
        } else if (data instanceof Blob) {
          try {
            const text = await data.text();
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.message === "string") {
              message = parsed.message;
              code = typeof parsed.code === "string" ? parsed.code : null;
            }
          } catch {}
        }

        const finalMessage =
          message ||
          axiosError.message ||
          removeTextContent.defaultProcessingError;
        setProcessingError(finalMessage);
        setVisitorBlocked(!userLoged && code === "VISITOR_QUOTA_EXCEEDED");
        // In async flow, keep job identifiers so the user can still recover via GET.
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
      setJobStatus(null);
      setJobRequestId(null);
      setVisitorBlocked(false);
      setResponseApi((previous) => {
        revokeIfBlobUrl(previous);
        return "";
      });
      return;
    }
    // Align UX with backend upload limits (visitor/free/hobby...).
    const { maxBytes, maxMb } = getMaxUploadForUser({
      plans: planOptionsSignal.value,
      isAuthenticated: Boolean(userLoged),
      planCode: sessionSignal.value?.plan?.code || null,
    });
    if (file.size > maxBytes) {
      setSelectedFile(null);
      setFileToProcess(null);
      setProcessingError(
        `Image trop volumineuse. Taille max: ${maxMb} MB.`
      );
      setJobStatus(null);
      setJobRequestId(null);
      setResponseApi((previous) => {
        revokeIfBlobUrl(previous);
        return "";
      });
      return;
    }
    setSelectedFile(file);
    setProcessingError(null);
    setJobStatus(null);
    setJobRequestId(null);
    setVisitorBlocked(false);
    setResponseApi((previous) => {
      revokeIfBlobUrl(previous);
      return "";
    });
  };

  const confirmProcessing = () => {
    // Intentionally async-safe even though onClick doesn't await.
    (async () => {
      if (!selectedFile || isProcessing) return;

      // If we have a token, verify auth before starting the processing request.
      const token = readAuthToken();
      if (token) {
        try {
          setIsProcessing(true);
          await isAuthentified();
        } catch (err) {
          setIsProcessing(false);
          setProcessingError("Session expirée. Merci de te reconnecter puis réessayer.");
          return;
        }
      }

      setIsProcessing(false);
      setFileToProcess(selectedFile);
    })().catch(() => {});
  };

  const retrieveJobResult = async () => {
    const token = readAuthToken();
    if (!token || !jobRequestId) return;
    setIsProcessing(true);
    setProcessingError(null);
    try {
      const response = await api.get(
        `api/services/remove-bg-replicate/jobs/${encodeURIComponent(jobRequestId)}`,
        { timeout: 20000 },
      );
      const snap = response?.data as RemoveBgJobSnapshot | null;
      if (snap && snap.outputImageUrl) {
        setResponseApi((previous) => {
          revokeIfBlobUrl(previous);
          return String(snap.outputImageUrl);
        });
      }
      if (snap?.status) setJobStatus(String(snap.status) as any);
      if (snap?.errorMessage) setProcessingError(String(snap.errorMessage));
    } catch (err) {
      setProcessingError(removeTextContent.defaultProcessingError);
    } finally {
      setIsProcessing(false);
    }
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
          confirmDisabled={!selectedFile || isProcessing || visitorBlocked}
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
        {jobRequestId && processingError && !responseApi && (
          <div className="mx-auto max-w-xl px-4">
            <div className="alert alert-warning">
              <div className="flex flex-col gap-3">
                <div className="text-sm">
                  {processingError}
                </div>
                <button
                  className="btn btn-outline"
                  onClick={retrieveJobResult}
                  disabled={isProcessing}
                >
                  Récupérer mon image
                </button>
              </div>
            </div>
          </div>
        )}
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
