// UploadPage.tsx
//import des hooks
import { useState, useRef, useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { sessionSignal } from "@/stores/session";

//import des librairies
import { AnimatePresence, LazyMotion, domAnimation } from "motion/react";
import * as m from "motion/react-m";

//import des composants enfants
import { RemoveBg } from "@/components/services/RemoveBG";
import { SocialPicture } from "@/components/services/socialPicture";
import { ImageConverter } from "@/components/services/ImageConverter";
import { ServiceCard } from "@/components/card/ServiceCard";

//import des images
import iconBackground from "@/assets/images/icon/icon-arriere-plan-opt.svg";
import iconSocial from "@/assets/images/icon/icon-reseau-opt.svg";
import iconProduct from "@/assets/images/icon/icon-projecteurs-opt.svg";
import iconConvert from "@/assets/images/icon/icon-convertir-opt.svg";

//declaration des types
type UploadImgType = {
  label: string;
  placeholder: string;
  filename: string;
  preview: string;
  erase: string;
};

type CtaKey =
  | "title_home_1"
  | "title_home_2"
  | "label_choice"
  | "label_test"
  | "color_choice"
  | "color_test"
  | "bg"
  | "isBtn_2";

type CtaContent = Record<CtaKey, string | boolean>;

type PropsPage = {
  routeKey: string;
};

/**
 * retourne le poids max du fichier a uploader par le client
 *
 * @return {*} 
 */
function getMaxFileUpload() {
  const planType = sessionSignal.value?.plan.code || null;
  if(!planType) return 1
  let maxSize = 0;
  switch (planType) {
    case "free":
      maxSize = 1;
      break;
    
    case "hobby":
      maxSize = 5;
      break;
    
    case "pro":
      maxSize = 10;
      break;
  
    default:
      maxSize = 1;
      break;
  }

  return maxSize

}

const ServicesPage = ({ routeKey }: PropsPage) => {
  type ServiceId = "remove" | "social" | "product" | "convert" | string;
  const [service, setService] = useState<ServiceId | null>(null);
  const { t } = useTranslation();
  const userLoged = sessionSignal?.value?.authentified || false;
  console.log("isLoged: ", userLoged);

  const containerService = useRef<HTMLDivElement | null>(null);

  //contenu textuel du composant RemoveBG
  const textUploadImgComponent: UploadImgType = {
    label: t("uploadImg.label"),
    placeholder: t("uploadImg.placeHolder"),
    filename: t("uploadImg.fileName"),
    preview: t("uploadImg.preview"),
    erase: t("uploadImg.erase"),
  };
  const removeBgContent = {
    confirmLabelIdle: t("removeBg.confirmLabelIdle"),
    confirmLabelProcessing: t("removeBg.confirmLabelProcessing"),
    planSimulation: t("removeBg.planSimulation"),
    planFree: t("removeBg.planFree"),
    planHobby: t("removeBg.planHobby"),
    planPro: t("removeBg.planPro"),
    loaderProcessing: t("removeBg.loaderProcessing"),
    defaultProcessingError: t("removeBg.defaultProcessingError"),
  };

  const imgEditorContent = {
    title: t("imgEditor.title"),
    tabColorPicker: t("imgEditor.tabColorPicker"),
    tabImagePicker: t("imgEditor.tabImagePicker"),
    resetBackground: t("imgEditor.resetBackground"),
    restrictedOption: t("imgEditor.restrictedOption"),
    imageSearchIntro: t("imgEditor.imageSearchIntro"),
    imageSearchPlaceholder: t("imgEditor.imageSearchPlaceholder"),
    imageSearchAriaLabel: t("imgEditor.imageSearchAriaLabel"),
    imageSearchButton: t("imgEditor.imageSearchButton"),
    imageSearchLoading: t("imgEditor.imageSearchLoading"),
    imageSearchError: t("imgEditor.imageSearchError"),
    imageRoyaltyFreeLabel: t("imgEditor.imageRoyaltyFreeLabel"),
    paginationPrev: t("imgEditor.paginationPrev"),
    paginationNext: t("imgEditor.paginationNext"),
    paginationPageLabel: t("imgEditor.paginationPageLabel"),
    paginationPageEmpty: t("imgEditor.paginationPageEmpty"),
    backgroundAlt: t("imgEditor.backgroundAlt"),
    previewTitle: t("imgEditor.previewTitle"),
    previewDescription: t("imgEditor.previewDescription"),
    previewAlt: t("imgEditor.previewAlt"),
    previewError: t("imgEditor.previewError"),
    previewRetry: t("imgEditor.previewRetry"),
    previewCancel: t("imgEditor.previewCancel"),
    previewConfirm: t("imgEditor.previewConfirm"),
    eraserCancel: t("imgEditor.eraserCancel"),
    eraserRetry: t("imgEditor.eraserRetry"),
    eraserClearMask: t("imgEditor.eraserClearMask"),
    eraserConfirmMask: t("imgEditor.eraserConfirmMask"),
    eraserProcessing: t("imgEditor.eraserProcessing"),
    eraserApplyToEditor: t("imgEditor.eraserApplyToEditor"),
    eraserResultIntro: t("imgEditor.eraserResultIntro"),
    eraserResultAlt: t("imgEditor.eraserResultAlt"),
    eraserDrawIntro: t("imgEditor.eraserDrawIntro"),
    eraserZoneAlt: t("imgEditor.eraserZoneAlt"),
  };

  const downloadLinkContent = {
    pending: t("downloadLink.pending"),
    download: t("downloadLink.download"),
    noCredits: t("downloadLink.noCredits"),
    errorPrefix: t("downloadLink.errorPrefix"),
    invalidSource: t("downloadLink.invalidSource"),
    retrieveError: t("downloadLink.retrieveError"),
    fileTypeDescription: t("downloadLink.fileTypeDescription"),
  };

  const converterContent = {
    headerTagline: t("imageConverter.headerTagline"),
    headerTitle: t("imageConverter.headerTitle"),
    headerDescription: t("imageConverter.headerDescription"),
    dropzonePrompt: t("imageConverter.dropzonePrompt"),
    dropzoneButton: t("imageConverter.dropzoneButton"),
    dimensionsTitle: t("imageConverter.dimensionsTitle"),
    dimensionsDescription: t("imageConverter.dimensionsDescription"),
    dimensionsReset: t("imageConverter.dimensionsReset"),
    dimensionsWidth: t("imageConverter.dimensionsWidth"),
    dimensionsHeight: t("imageConverter.dimensionsHeight"),
    dimensionsLockAspect: t("imageConverter.dimensionsLockAspect"),
    dimensionsOriginalPrefix: t("imageConverter.dimensionsOriginalPrefix"),
    formatTitle: t("imageConverter.formatTitle"),
    formatDescription: t("imageConverter.formatDescription"),
    formatExtension: t("imageConverter.formatExtension"),
    qualityLabel: t("imageConverter.qualityLabel"),
    qualityPriorityWeight: t("imageConverter.qualityPriorityWeight"),
    qualityPriorityQuality: t("imageConverter.qualityPriorityQuality"),
    filtersTitle: t("imageConverter.filtersTitle"),
    filtersDescription: t("imageConverter.filtersDescription"),
    filtersReset: t("imageConverter.filtersReset"),
    actionClear: t("imageConverter.actionClear"),
    actionConvert: t("imageConverter.actionConvert"),
    previewTitle: t("imageConverter.previewTitle"),
    previewAlt: t("imageConverter.previewAlt"),
    previewEmpty: t("imageConverter.previewEmpty"),
    previewHint: t("imageConverter.previewHint"),
    summaryDimensions: t("imageConverter.summaryDimensions"),
    summaryFormat: t("imageConverter.summaryFormat"),
    summaryQuality: t("imageConverter.summaryQuality"),
    changeImage: t("imageConverter.changeImage"),
    downloadConverted: t("imageConverter.downloadConverted"),
    deleteConverted: t("imageConverter.deleteConverted"),
    assetReadyPrefix: t("imageConverter.assetReadyPrefix"),
    finalAlt: t("imageConverter.finalAlt"),
    finalDescription: t("imageConverter.finalDescription"),
    emptyConversionHint: t("imageConverter.emptyConversionHint"),
    needPlanLink: t("imageConverter.needPlanLink"),
    statusDeleted: t("imageConverter.statusDeleted"),
    statusNoFile: t("imageConverter.statusNoFile"),
    statusLoading: t("imageConverter.statusLoading"),
    statusSuccess: t("imageConverter.statusSuccess"),
    statusError: t("imageConverter.statusError"),
    statusParamsModified: t("imageConverter.statusParamsModified"),
    previewError: t("imageConverter.previewError"),
    filterBrightness: t("imageConverter.filters.brightness"),
    filterContrast: t("imageConverter.filters.contrast"),
    filterSaturation: t("imageConverter.filters.saturation"),
    filterHue: t("imageConverter.filters.hue"),
    filterGrayscale: t("imageConverter.filters.grayscale"),
    filterBlur: t("imageConverter.filters.blur"),
    filterBlurHelper: t("imageConverter.filters.blurHelper"),
  };

  const ctaContent: CtaContent = {
    title_home_1: t("cta.title_home_1"),
    title_home_2: t("cta.title_home_1"),
    label_choice: t("cta.label_choice"),
    label_test: t("cta.label_test"),
    color_choice: "btn-success",
    color_test: "btn-primary",
    bg: "bg-base-200",
    isBtn_2: false,
  };

  const contentCardService = [
    {
      active:true,
      id: t("serviceCardContent.card_1.id"),
      src: iconBackground,
      title: t("serviceCardContent.card_1.title"),
      description: t("serviceCardContent.card_1.description"),
    },
    {
      active: false,
      id: t("serviceCardContent.card_2.id"),
      src: iconSocial,
      title: t("serviceCardContent.card_2.title"),
      description: t("serviceCardContent.card_2.description"),
    },
    {
      active:true,
      id: t("serviceCardContent.card_3.id"),
      src: iconConvert,
      title: t("serviceCardContent.card_3.title"),
      description: t("serviceCardContent.card_3.description"),
    },
    {
      active: false,
      id: t("serviceCardContent.card_4.id"),
      src: iconProduct,
      title: t("serviceCardContent.card_4.title"),
      description: t("serviceCardContent.card_4.description"),
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const paramValue = params.get("service");
    if (paramValue) {
      setService(paramValue);
      try {
        localStorage.setItem("wizpix:last_service", paramValue);
      } catch {}
      return;
    }

    try {
      const stored = localStorage.getItem("wizpix:last_service");
      if (stored) setService(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (service === null) return;
    try {
      localStorage.setItem("wizpix:last_service", service);
    } catch {}
    const el = containerService.current;
    if (!el) return;
   
    setTimeout(() => {
      
      el.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    }, 500);
  }, [service]);

  return (
    <div className="page-container">
      <div
        className={
          "relative w-full mx-auto max-w-[1300px] py-[50px] px-[10px] flex flex-col justify-start items-center gap-[30px]"
        }
      >
        <h1 className={"text-center text-4xl font-bold  lg:text-6xl"}>
          {userLoged
            ? t("servicePageTitle.title_h1_loged")
            : t("servicePageTitle.title_h1")}
        </h1>
      </div>
      <ul
        className={
          "my-16 w-full max-w-[1200px] flex flex-col justify-start items-center gap-y-10 lg:flex-row lg:flex-wrap lg:justify-evenly lg:gap-x-10"
        }
      >
        {contentCardService.map((cardContent) => {
          return (
            <li key={cardContent.id}>
              <ServiceCard content={cardContent} selectService={setService} />
            </li>
          );
        })}
      </ul>
      <div
        id="container-service"
        ref={containerService}
        className={"w-full max-w-[1300px]"}
      >
        <LazyMotion features={domAnimation}>
          <AnimatePresence>
            {service === "remove" ? (
              <m.div
                key="background-preview"
                className=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <RemoveBg
                  removeTextContent={removeBgContent}
                  uploadTextContent={textUploadImgComponent}
                  imgEditorTextContent={imgEditorContent}
                  downloadLinkTextContent={downloadLinkContent}
                />
              </m.div>
            ) : null}
            {service === "social" ? (
              <m.div
                key="social-picture"
                className="w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SocialPicture />
              </m.div>
            ) : null}
            {service === "convert" ? (
              <m.div
                key="image-converter"
                className="w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ImageConverter converterTextContent={converterContent} />
              </m.div>
            ) : null}
          </AnimatePresence>
        </LazyMotion>
      </div>
    </div>
  );
};

export { ServicesPage };
