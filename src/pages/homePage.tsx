//Page home

//import des hooks
import { useEffect } from "preact/hooks";

//import des librairies
import { useTranslation } from "react-i18next";

//import de compoants enfants
import { Cta } from '@/components/cta/Cta';
import { Hero } from "@/components/hero/hero";
import { Diff } from "../components/diff/diff";

//import de fonctions
import { setDocumentTitle } from "@/utils/setDocumentTitle";



type Labels = string[];

type HeroContentKey =
  | "title_h1"
  | "title_h2"
  | "info_1"
  | "info_2"
  | "info_list_1"
  | "info_list_1_link"
  | "info_list_2"
  | "info_list_3"
  | "privacy_1"
  | "privacy_1_link"
  | "privacy_2";
  

type CtaKey = "label_choice" | "label_test" | "color_choice" | "color_test" | "bg";
type CtaContent = Record<CtaKey, string>;


function HomePage() {
  const { t } = useTranslation();


  //hero content
  const heroContent: Record<HeroContentKey, string> = {
    title_h1: t("heroHome.title_h1"),
    title_h2: t("heroHome.title_h2"),
    info_1: t("heroHome.info_1"),
    info_2: t("heroHome.info_2"),
    info_list_1: t("heroHome.info_list_1"),
    info_list_1_link: t("heroHome.info_list_1_link"),
    info_list_2: t("heroHome.info_list_2"),
    info_list_3: t("heroHome.info_list_3"),
    privacy_1: t("heroHome.privacy_1"),
    privacy_1_link: t("heroHome.privacy_1_link"),
    privacy_2: t("heroHome.privacy_2"),
    
  };

  const ctaContent: CtaContent = {
    label_choice: t("cta.label_choice"),
    label_test: t("cta.label_test"),
    color_choice: "btn-success",
    color_test: "btn-primary",
    bg: "bg-base-200",
  };

  const ctaContent_2: CtaContent = {
    label_choice: t("cta.label_choice"),
    label_test: t("cta.label_test"),
    color_choice: "btn-success",
    color_test: "btn-primary",
    bg: "",
  };


  //buton label
  const labels: Labels = [
    t("diff.friend_label"),
    t("diff.pet_label"),
    t("diff.sport_label"),
    t("diff.vehicule_label"),
    t("diff.logo_label"),
  ];
  //buton label
  const label: Labels = [
    
  ];

  useEffect(() => {
    setDocumentTitle()
  }, []);

  return (
    <div
      className={
        "mx-auto flex flex-col justify-start items-center w-full px-[10px]"
      }
    >
      <div className={"w-full"}>
        <div className={"flex flex-col justify-start items-center mx-auto"}>
          <Hero content={heroContent} />
          <Cta cta={ctaContent} />
        </div>
      </div>
      <div className={"bg-secondary/5 w-full py-[50px]"}>
        <div
          className={
            "flex flex-col justify-start items-center mx-auto max-w-[1000px]"
          }
        >
          <h1 className="mb-[50px] self-center text-center text-4xl font-bold lg:w-[60%] lg:text-6xl lg:self-start lg:text-left">
            Un aperçu du rendu des images sans arrière plan.
          </h1>
          <Diff tag={labels} />
        </div>
          <Cta cta={ctaContent_2} />
      </div>
    </div>
  );
}

export { HomePage };
