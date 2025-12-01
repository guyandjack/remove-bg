//Page home

//import des hooks
import { useEffect } from "preact/hooks";

//import des librairies
import { useTranslation } from "react-i18next";

//import de compoants enfants
import { CtaStyled } from "@/components/cta/CtaStyled";
import { Hero } from "@/components/hero/hero";
import { StepAction } from "@/components/stepAction/stepAction";
import { FeatureCard } from "../components/card/FeatureCard";
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

/* type CtaKey =
  | "title_home_1"
  | "title_home_2"
  | "label_choice"
  | "label_test"
  | "color_choice"
  | "color_test"
  | "bg"
  | "isBtn_2"; */


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
    title_home_1: t("cta.title_home_1"),
    title_home_2: t("cta.title_home_1"),
    label_choice: t("cta.label_choice"),
    label_test: t("cta.label_test"),
    color_choice: "btn-success",
    color_test: "btn-primary",
    bg: "bg-base-200",
    isBtn_2 : true
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
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
</svg>
`,

      title: "Développeurs Web",
      description:
        "Automatisez le détourage et la retouche d’images directement dans vos applications grâce à une API simple et rapide.",
    },
    {
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
</svg>
`,
      title: "Photographes",
      description:
        "Gagnez un temps précieux en supprimant automatiquement les arrière-plans et en améliorant vos clichés en quelques secondes.",
    },
    {
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
</svg>

`,
      title: "Boutiques e-commerce",
      description:
        "Créez des visuels produits propres, homogènes et prêts à être publiés sur votre site ou marketplace.",
    },
    {
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
</svg>
`,
      title: "Designers & Graphistes",
      description:
        "Accélérez votre workflow en générant des détourages propres et des mises en scène réalistes sans travail manuel.",
    },
    {
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
</svg>

`,
      title: "Créateurs de contenu",
      description:
        "Préparez des vignettes, miniatures et visuels attractifs sans compétences avancées en retouche.",
    },
    {
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
</svg>
`,
      title: "Agences Marketing",
      description:
        "Produisez rapidement des images optimisées pour les campagnes publicitaires et les réseaux sociaux.",
    },
    {
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
</svg>
`,
      title: "Gestionnaires de Marketplace",
      description:
        "Uniformisez les images des vendeurs en supprimant automatiquement les fonds pour respecter vos standards visuels.",
    },
    {
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
</svg>
`,
      title: "Immobilier",
      description:
        "Nettoyez ou modifiez des photos de biens, supprimez des éléments gênants ou mettez les objets en valeur.",
    },
    {
      url: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10 stroke-primary">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
</svg>
`,
      title: "Artisans & Créateurs",
      description:
        "Valorisez vos produits avec des images nettes et professionnelles sans matériel coûteux.",
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
    setDocumentTitle();
  }, []);

  return (
    <div
      className={
        "w-full px-[10px] mx-auto bg-page flex flex-col justify-start items-center"
      }
    >
      <div className={"w-full p-10"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <Hero content={heroContent} />
        </div>
      </div>
      <div className={"w-full bg-component py-[100px]"}>
        <div
          className={
            "w-full max-w-[1300px] mx-auto flex flex-col justify-start items-center mx-auto"
          }
        >
          <StepAction content={stepsContent} />
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
                <li className={""}>
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
