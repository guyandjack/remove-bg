// UploadPage.tsx
//import des hooks
import { useState, useEffect, useRef } from "preact/hooks";
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
import { planOption24 } from "@/data/content/components/editor/planOption";

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
  const [typePlan, setTypePlan] = useState<string>(sessionSignal?.value?.plan?.code ||
    sessionSignal?.value?.plan?.name ||
    "")

  const planChoiceEl = useRef<HTMLUListElement | null>(null);
  const objectSession: string = localStorage.getItem("session") || "";
  let creditRemaining = 0;
  if (objectSession !== "") {
    
    const objectSessionParsed = JSON.parse(objectSession);
    const localCredits = objectSessionParsed.credits.remaining_last_24h;
    creditRemaining = sessionSignal?.value?.credits?.remaining_last_24h || localCredits;
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
      return
    };

    if (elementList) {
      const buttons = Array.from(elementList?.querySelectorAll("button")) || null;
      buttons.forEach((btn) => {
        btn.classList.remove("opacity-[1]");
        btn.style.outline = "none";
      })
      const el = e?.currentTarget as HTMLElement | null;
      if (!el) return;

      const plan = el.dataset.plan?.trim();
      if (!plan) return;

      el.classList.add("opacity-[1]");
      el.style.outline = "dashed red";
      setTypePlan(plan);
    }
  };


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

  //affiche le titre de la page dans l' onglet
  useEffect(() => {
    setDocumentTitle();
  }, []);

  //si un utilisateur est connecté
  // Image editor sera remonte avec la valeur du plan de l'utilisateur connecte
  useEffect(() => {
    if(!userLoged) return
   setTypePlan(sessionSignal?.value?.plan?.code || "");
  }, [sessionSignal?.value?.plan?.code]);


  const shouldShowEditor =
    isCdnLoaded && responseApi !== "" && previewUrl !== null && !isProcessing;
  
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
        block: "center", // centre verticalement
        inline: "center", // centre horizontalement (si utile)
      });
    }
  }, [shouldShowEditor]);


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
      {!userLoged && shouldShowEditor ? (
        <ul
          ref={planChoiceEl}
          className={
            "mx-auto max-w-[1300px] flex flex-col justify-start items-center gap-3 lg:flex-row lg:gap-5"
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
      <div id="editor" className="mt-6 w-full">
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
