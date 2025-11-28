// UploadPage.tsx
//import des hooks
import { useState, useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";

//import des composants enfants
import { UploadImg, UploadImgType } from "@/components/form/UploadImg";
import { ImgEditor } from "@/components/imgEditor/imgEditor";
import { Loader } from "@/components/loader/Loader";
import { Example } from "@/components/colorPicker/colorPicker";

//import des fonctions
import { loadScript } from "@/utils/loadScript";
import { sessionSignal } from "@/stores/session";
import { setDocumentTitle } from "@/utils/setDocumentTitle";

// CDN de l'éditeur
const editorCdn =
  "https://scaleflex.cloudimg.io/v7/plugins/filerobot-image-editor/latest/filerobot-image-editor.min.js";

const UploadPage = () => {
  const { t } = useTranslation();
  const userLoged = sessionSignal?.value?.authentified;
  const textUploadImgComponent:UploadImgType = {
    label: t("uploadImg.label"),
    placeholder: t("uploadImg.placeHolder"),
    filename: t("uploadImg.fileName"),
    preview: t("uploadImg.preview"),
    erase: t("uploadImg.erase")
  }
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // true quand on doit lancer traitement + chargement CDN
  const [callApi, setCallApi] = useState(false);

  // ici tu stockeras la vraie réponse de ton API (URL ou base64)
  const [responseApi, setResponseApi] = useState<string>("");

  const [isCdnLoaded, setCdnLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const typePlan =
    sessionSignal?.value?.plan?.code ||
    sessionSignal?.value?.plan?.name ||
    "noplan";
  const objectSession: string = localStorage.getItem("session") || "";
  let creditRemaining = 0;
  if (objectSession !== "") {
    
    const objectSessionParsed = JSON.parse(objectSession);
    const localCredits = objectSessionParsed.credits.remaining_last_24h;
    creditRemaining = sessionSignal?.value?.credits?.remaining_last_24h || localCredits ;
  }

  // Effet : quand callApi passe à true → on lance API + CDN
  useEffect(() => {
    if (!callApi) return;

    setIsProcessing(true);

    // 1) chargement CDN
    const cdnPromise = loadScript(editorCdn).then(() => {
      setCdnLoaded(true);
    });

    // 2) ici tu mettras ton vrai appel à l’API de traitement
    // pour l’instant on simule (tu peux aussi le laisser dans l’enfant, mais je trouve plus propre ici)
    const apiPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        // TODO: remplacer par la vraie URL/base64 renvoyée par ton backend
        import("@/assets/images/friend-removebg-preview.png").then((mod) => {
          resolve(mod.default);
        });
      }, 2000);
    }).then((result) => {
      setResponseApi(result);
    });

    // on attend les deux en parallèle
    Promise.all([cdnPromise, apiPromise])
      .catch((err) => {
        console.error("Erreur pendant chargement éditeur ou API :", err);
      })
      .finally(() => {
        setIsProcessing(false);
        setCallApi(false); // on remet le flag à false
      });
  }, [callApi]);
  useEffect(() => {
    setDocumentTitle();
  }, []);

  const shouldShowEditor =
    isCdnLoaded && responseApi !== "" && previewUrl !== null && !isProcessing;

  return (
    <div className="px-[10px] w-full mx-auto pb-[100px] bg-base-200">
      <div
        className={
          "relative w-full mx-auto max-w-[1300px] py-[50px] px-[10px] flex flex-col justify-start items-center gap-[30px]"
        }
      >
        <h1
          className={
            "text-center text-4xl font-bold lg:w-[40%] lg:text-6xl lg:text-left lg:self-start lg:leading-[60px]!"
          }
        >
          {userLoged ? t("upload.title_h1_loged") : t("upload.title_h1")}
        </h1>

        <UploadImg
          setPreviewUrl={setPreviewUrl}
          previewUrl={previewUrl}
          setCallApi={setCallApi}
          setResponseApi={setResponseApi} // tu peux le retirer si tu déplaces toute la logique API dans le parent
          content={textUploadImgComponent}
        />
      </div>
      <div id="editor" className="relative mt-6 w-full min-h-[1000px]">
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
}

export { UploadPage };
