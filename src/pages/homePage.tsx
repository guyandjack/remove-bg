//Page home

//import des hooks
import { useEffect } from "preact/hooks";

//import des librairies
import { useTranslation } from "react-i18next";

//import de compoants enfants
import { CtaStyled } from "@/components/cta/CtaStyled";
import { FinalCTA } from "@/components/cta/ctaFinal";
import { Hero } from "@/components/hero/hero";
import { StepAction } from "@/components/stepAction/stepAction";
import { ProblemSection } from "@/components/problemSection/problemSection";
import { FeatureCard } from "../components/card/FeatureCard";
import { Diff } from "../components/diff/diff";
import { ServiceCard } from "../components/card/ServiceCard";
import { Faq } from "../components/faq/Faq";

//import de fonctions
import { setDocumentTitle } from "@/utils/setDocumentTitle";
import { setActiveLink } from "@/utils/setActiveLink";

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

type CtaContent = {
  title_home_1: string;
  title_home_2: string;
  label_choice: string;
  label_test: string;
  color_choice: string;
  color_test: string;
  bg: string;
  isBtn_2: boolean;
};

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

type PropsPage = {
  routeKey: string;
};

function HomePage({ routeKey = "" }: PropsPage) {
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
    title_home_1: t("cta.title_home_1"),
    title_home_2: t("cta.title_home_1"),
    label_choice: t("cta.label_choice"),
    label_test: t("cta.label_test"),
    color_choice: "btn-success",
    color_test: "btn-primary",
    bg: "bg-base-200",
    isBtn_2: true,
  };

  const ctaContent_2: CtaContent = {
    title_home_1: t("cta.title_home_1"),
    title_home_2: t("cta.title_home_2"),
    label_choice: t("cta.label_choice"),
    label_test: t("cta.label_test"),
    color_choice: "btn-success",
    color_test: "btn-primary",
    bg: "",
    isBtn_2: true,
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

  const cardFeatureContent = [
    {
      url: t("featureCardContent.card_1.url"),
      title: t("featureCardContent.card_1.title"),
      description: t("featureCardContent.card_1.description"),
    },
    {
      url: t("featureCardContent.card_2.url"),
      title: t("featureCardContent.card_2.title"),
      description: t("featureCardContent.card_2.description"),
    },
    {
      url: t("featureCardContent.card_3.url"),
      title: t("featureCardContent.card_3.title"),
      description: t("featureCardContent.card_3.description"),
    },
    {
      url: t("featureCardContent.card_4.url"),
      title: t("featureCardContent.card_4.title"),
      description: t("featureCardContent.card_4.description"),
    },
    {
      url: t("featureCardContent.card_5.url"),
      title: t("featureCardContent.card_5.title"),
      description: t("featureCardContent.card_5.description"),
    },
    {
      url: t("featureCardContent.card_6.url"),
      title: t("featureCardContent.card_6.title"),
      description: t("featureCardContent.card_6.description"),
    },
    {
      url: t("featureCardContent.card_7.url"),
      title: t("featureCardContent.card_7.title"),
      description: t("featureCardContent.card_7.description"),
    },
    {
      url: t("featureCardContent.card_8.url"),
      title: t("featureCardContent.card_8.title"),
      description: t("featureCardContent.card_8.description"),
    },
    {
      url: t("featureCardContent.card_9.url"),
      title: t("featureCardContent.card_9.title"),
      description: t("featureCardContent.card_9.description"),
    },
  ];

  const contentCardService = [
    {
      id: t("serviceCardContent.card_1.id"),
      src: t("serviceCardContent.card_1.src"),
      title: t("serviceCardContent.card_1.title"),
      description: t("serviceCardContent.card_1.description"),
    },
    {
      id: t("serviceCardContent.card_2.id"),
      src: t("serviceCardContent.card_2.src"),
      title: t("serviceCardContent.card_2.title"),
      description: t("serviceCardContent.card_2.description"),
    },
    {
      id: t("serviceCardContent.card_3.id"),
      src: t("serviceCardContent.card_3.src"),
      title: t("serviceCardContent.card_3.title"),
      description: t("serviceCardContent.card_3.description"),
    },
    {
      id: t("serviceCardContent.card_4.id"),
      src: t("serviceCardContent.card_4.src"),
      title: t("serviceCardContent.card_4.title"),
      description: t("serviceCardContent.card_4.description"),
    },
  ];

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
    setActiveLink();
    setDocumentTitle();
  }, [routeKey]);

  return (
    <div className={"page-container"}>
      <div className={"w-full"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <Hero content={heroContent} />
        </div>
      </div>
      <div className={"w-full"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <h2 className="mb-[50px] text-center text-3xl font-bold lg:w-[60%] lg:text-5xl">
            Nos services
          </h2>
          <ul
            className={
              "mt-16 w-full max-w-[1300px] flex flex-col justify-start items-center gap-y-5 lg:flex-row lg:flex-wrap lg:justify-evenly lg:gap-x-5"
            }
          >
            {contentCardService.map((cardContent) => {
              return (
                <li key={cardContent.id}>
                  <ServiceCard content={cardContent} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className={"w-full bg-component py-[50px]"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <StepAction content={stepsContent} />
        </div>
      </div>
      <div className={"w-full bg-component py-[50px]"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <ProblemSection />
        </div>
      </div>
      <div className={"w-full bg-component"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <FinalCTA />
        </div>
      </div>

      <div className={"w-full pt-[200px]"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <h2 className="mb-[50px] self-center text-center text-3xl font-bold lg:w-[60%] lg:text-5xl lg:self-start lg:text-left">
            {"Un aperçu du rendu des images sans arrière plan."}
          </h2>
          <div className={"w-full max-w-[800px] lg:w-[50%]"}>
            <Diff tag={labels} />
          </div>
        </div>
      </div>
      <div className={"w-full py-[200px] bg-page"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <h2 className="mb-[50px] self-center text-center text-3xl font-bold lg:w-[60%] lg:text-5xl lg:self-start lg:text-left">
            A qui s'adresse notre service
          </h2>
          <ul
            className={
              "w-full flex flex-row flex-wrap justify-evenly items-center gap-y-8 "
            }
          >
            {cardFeatureContent.map((cardContent) => {
              return (
                <li key={cardContent.title}>
                  <FeatureCard content={cardContent} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className={"w-full bg-secondary/20"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <CtaStyled content={ctaContent} />
        </div>
      </div>

      <div className={"w-full pt-[200px]"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <h2 className="mb-[50px] text-center text-3xl font-bold lg:w-[60%] lg:text-5xl">
            Questions frequentes
          </h2>
          <div className={"mb-[100px]"}>
            <Faq text={faqContent} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { HomePage };
