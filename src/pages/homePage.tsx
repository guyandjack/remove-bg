//Page home

//import des hooks
import { useEffect } from "preact/hooks";

//import des librairies
import { useTranslation } from "react-i18next";

//import de compoants enfants
import { StepAction } from "@/components/stepAction/stepAction";
import { Cta } from "@/components/cta/Cta";
import { CtaStyled } from "@/components/cta/CtaStyled";
import { Hero } from "@/components/hero/hero";
import { Diff } from "../components/diff/diff";
import { Faq } from "../components/faq/Faq";

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

type CtaKey =
  | "label_choice"
  | "label_test"
  | "color_choice"
  | "color_test"
  | "bg";

type CtaContent = Record<CtaKey, string>;

type StepsNumber = {
  title: string;
  description: string;
};
type stepsContent = {
  title: string;
  intro: string;
  step_1: StepsNumber;
  step_2: StepsNumber;
  step_3: StepsNumber;
};

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

  //contenu textuel du composant stepsAction
  const stepsContent: stepsContent = {
    title: t("stepsContent.title"),
    intro: t("stepsContent.intro"),
    step_1: {
      title: t("stepsContent.step_1.title"),
      description: t("stepsContent.step_1.description"),
    },
    step_2: {
      title: t("stepsContent.step_2.title"),
      description: t("stepsContent.step_2.description"),
    },
    step_3: {
      title: t("stepsContent.step_3.title"),
      description: t("stepsContent.step_3.description"),
    },
  };

  const faqContent = [
    {
      question: t("faqHome.question_1"),
      response: t("faqHome.reponse_1"),
    },

    { question: t("faqHome.question_2"), response: t("faqHome.reponse_2") },

    { question: t("faqHome.question_3"), response: t("faqHome.reponse_3") },

    { question: t("faqHome.question_4"), response: t("faqHome.reponse_4") },

    { question: t("faqHome.question_5"), response: t("faqHome.reponse_5") },

    { question: t("faqHome.question_6"), response: t("faqHome.reponse_6") },

    { question: t("faqHome.question_7"), response: t("faqHome.reponse_7") },

    { question: t("faqHome.question_8"), response: t("faqHome.reponse_8") },

    { question: t("faqHome.question_9"), response: t("faqHome.reponse_9") },

    { question: t("faqHome.question_10"), response: t("faqHome.reponse_10") },

    { question: t("faqHome.question_11"), response: t("faqHome.reponse_11") },

    { question: t("faqHome.question_12"), response: t("faqHome.reponse_12") },

    { question: t("faqHome.question_13"), response: t("faqHome.reponse_13") },

    { question: t("faqHome.question_14"), response: t("faqHome.reponse_14") },

    { question: t("faqHome.question_15"), response: t("faqHome.reponse_15") },

    { question: t("faqHome.question_16"), response: t("faqHome.reponse_16") },
  ];
  //buton label
  const label: Labels = [];

  useEffect(() => {
    setDocumentTitle();
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
          <StepAction content={stepsContent} />
          {/* <Cta cta={ctaContent} /> */}
          <CtaStyled content={ctaContent} />
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
      <h2
        className={
          "font-bold text-3xl text-center text-info lg:text-left lg:self-start"
        }
      >
        Questions frequentes
      </h2>
      <div className={"mb-[100px]"}>
        <Faq text={faqContent} />
      </div>
    </div>
  );
}

export { HomePage };
