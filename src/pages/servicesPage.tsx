// UploadPage.tsx
//import des hooks
import { useEffect, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { sessionSignal } from "@/stores/session";

//import des librairies
import { AnimatePresence, LazyMotion, domAnimation } from "motion/react";
import * as m from "motion/react-m";

//import des composants enfants
import { RemoveBg } from "@/components/services/RemoveBG";
import { SocialPicture } from "@/components/services/socialPicture";
import { BannerService } from "@/components/banner/bannerService";

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
    "remove" | "social" | "product" | "convert"
  >();
  const { t } = useTranslation();
  const userLoged = sessionSignal?.value?.authentified || false;

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
      <div>
        <BannerService selectService={setService} />
      </div>
      <div>
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
          </AnimatePresence>
        </LazyMotion>
      </div>
    </div>
  );
};

export { ServicesPage };
