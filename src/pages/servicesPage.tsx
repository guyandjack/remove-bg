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

const ServicesPage = ({ routeKey }: PropsPage) => {
  const [service, setService] = useState<
    "remove" | "social" | "product" | "convert" | null | string
  >(null);
  const { t } = useTranslation();
  const userLoged = sessionSignal?.value?.authentified || false;

  const containerService = useRef(null);

  //contenu textuel du composant RemoveBG
  const textUploadImgComponent: UploadImgType = {
    label: t("uploadImg.label"),
    placeholder: t("uploadImg.placeHolder"),
    filename: t("uploadImg.fileName"),
    preview: t("uploadImg.preview"),
    erase: t("uploadImg.erase"),
  };
  const removeBgContent = {};

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
      id: t("serviceCardContent.card_1.id"),
      src: iconBackground,
      title: t("serviceCardContent.card_1.title"),
      description: t("serviceCardContent.card_1.description"),
    },
    {
      id: t("serviceCardContent.card_2.id"),
      src: iconSocial,
      title: t("serviceCardContent.card_2.title"),
      description: t("serviceCardContent.card_2.description"),
    },
    {
      id: t("serviceCardContent.card_3.id"),
      src: iconConvert,
      title: t("serviceCardContent.card_3.title"),
      description: t("serviceCardContent.card_3.description"),
    },
    {
      id: t("serviceCardContent.card_4.id"),
      src: iconProduct,
      title: t("serviceCardContent.card_4.title"),
      description: t("serviceCardContent.card_4.description"),
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const paramValue = params.get("service");
    if (!paramValue) return;
    setService(paramValue);
  }, []);

  useEffect(() => {
    if (service === null) return;
    if (!containerService.current) return;
   
    setTimeout(() => {
      
      containerService.current.scrollIntoView({
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
          {userLoged ? t("upload.title_h1_loged") : t("upload.title_h1")}
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
                <ImageConverter />
              </m.div>
            ) : null}
          </AnimatePresence>
        </LazyMotion>
      </div>
    </div>
  );
};

export { ServicesPage };
