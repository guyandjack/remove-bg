//import des hooks
import { useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";

//import des instance
import { api } from "@/utils/axiosConfig";

//import des composant enfants
import { PriceCard } from "@/components/card/priceCard";
import { Faq } from "@/components/faq/Faq";
import { PricingComparisonTable } from "@/components/table/PriceTable";

//import des fonctions
import {
  PlanOption,
  planOptionsSignal,
  setPlanOptions,
} from "@/stores/planOptions";
import { setDocumentTitle } from "@/utils/setDocumentTitle";


type PlanKey =
  | "remove_bg"
  | "tag"
  | "price"
  | "credit"
  | "gomme_magique"
  | "Image_pexels"
  | "api"
  | "bundle"
  | "subscribe";

type PlanText = Record<PlanKey, string>;

type PricePageProps = {
  routeKey?: string;
  isSignup?: boolean;
};

const  PricePage = ({ routeKey = "", isSignup = false }: PricePageProps)=> {
  const { t } = useTranslation();
  const planOptions = planOptionsSignal.value;

  const IsCreateAccount = isSignup;

  const textLangCard: PlanText = {
    tag: t("priceCard.tag"),
    remove_bg: t("priceCard.remove_bg"),
    price: t("priceCard.price"),
    credit: t("priceCard.credit"),
    gomme_magique: t("priceCard.gomme_magique"),
    Image_pexels: t("priceCard.img_pexels"),
    api: t("priceCard.api"),
    bundle: t("priceCard.bundle"),
    subscribe: t("priceCard.subscribe"),
  };

  const textLangTab = {
    title_h2: t("priceTab.title_h2"),
    col_free: t("priceTab.col_free"),
    col_hobby: t("priceTab.col_hobby"),
    col_pro: t("priceTab.col_pro"),
    price: t("priceTab.price"),
    credit: t("priceTab.credit"),
    formats: t("priceTab.formats"),
    remove_bg: t("priceTab.remove_bg"),
    change_bg_color: t("priceTab.change_bg_color"),
    tools: t("priceTab.tools"),
    model_IA_ressource: t("priceTab.model_IA_ressource"),
    gomme_magique: t("priceTab.gomme_magique"),
    img_pexels: t("priceTab.img_pexels"),
    delay_improved: t("priceTab.delay_improved"),
    bg_IA_generation: t("priceTab.bg_IA_generation"),
    bundle: t("priceTab.bundle"),
    api: t("priceTab.api"),
    api_external: t("priceTab.api_external"),
  };

  const textLangFaq = [
    {
      question: t("faqPricing.question_1"),
      response: t("faqPricing.reponse_1"),
    },
    {
      question: t("faqPricing.question_2"),
      response: t("faqPricing.reponse_2"),
    },
    {
      question: t("faqPricing.question_3"),
      response: t("faqPricing.reponse_3"),
    },
    {
      question: t("faqPricing.question_4"),
      response: t("faqPricing.reponse_4"),
    },
    {
      question: t("faqPricing.question_5"),
      response: t("faqPricing.reponse_5"),
    },
    {
      question: t("faqPricing.question_6"),
      response: t("faqPricing.reponse_6"),
    },
    {
      question: t("faqPricing.question_7"),
      response: t("faqPricing.reponse_7"),
    },
    {
      question: t("faqPricing.question_8"),
      response: t("faqPricing.reponse_8"),
    },
    {
      question: t("faqPricing.question_9"),
      response: t("faqPricing.reponse_9"),
    },
    {
      question: t("faqPricing.question_10"),
      response: t("faqPricing.reponse_10"),
    },
  ];

  useEffect(() => {
    console.log("use effect run");
    const hydrateFromCache = (): boolean => {
      const cache = localStorage.getItem("option");
      if (!cache)  {
        console.log("Pas objet option dans le localstorage. code_price-1 ");
        return false
      } 
      try {
        const parsed = JSON.parse(cache);
        if (!Array.isArray(parsed) || parsed.length === 0) {
         console.log("L' objet parsed n' est pas un tableau ou sa longeur est nulle code_price_2 ");
         return false;
        }
        setPlanOptions(parsed as PlanOption[]);
        console.log("Le tableau arrayOption a ete mis à jour avec le localstorage! ");
        
        return true;
      } catch (error) {
        console.warn("Option cache invalide, suppression… code_price_3", error);
        localStorage.removeItem("option");
        return false;
      }
    };

    const fetchOptions = async () => {
      try {
        const { data } = await api.get("api/plan/option");
        if (data?.status !== "success" || !Array.isArray(data?.plans)) {
          return;
        }
        localStorage.setItem("option", JSON.stringify(data.plans));
        setPlanOptions(data.plans);
        
      } catch (error) {
        console.error("Erreur lors de la récupération des plans", error);
      }
    };

    if (!hydrateFromCache()) {
      fetchOptions();
    }
  }, [routeKey]);

  useEffect(() => {
    setDocumentTitle();
  }, []);

  return (
    <div className={"px-[10px] w-full mx-auto pb-[100px] bg-base-200"}>
      <div
        className={
          "relative w-full mx-auto max-w-[1300px] py-[50px] px-[10px] flex flex-col justify-start items-center gap-[30px] "
        }
      >
        <h1
          className={
            "text-center text-4xl font-bold lg:w-[40%] lg:text-6xl lg:text-left lg:self-start"
          }
          dangerouslySetInnerHTML={{
            __html: t("pricing.title_h1").replace(/\n/g, "<br/>"),
          }}
        ></h1>
        <h2
          className={
            "font-bold text-3xl text-center text-info lg:text-left lg:self-start"
          }
          dangerouslySetInnerHTML={{
            __html: t("pricing.title_h2_card").replace(/\n/g, "<br/>"),
          }}
        ></h2>
        <p
          className={
            "font-medium text-xl text-center text-success lg:text-left lg:self-start"
          }
          dangerouslySetInnerHTML={{
            __html: t("pricing.intro").replace(/\n/g, "<br/>"),
          }}
        ></p>
        {IsCreateAccount ? (
          <div className={"absolute top-[-10px] left-[10px] z-100"}>
            <div role="alert" className="alert alert-warning alert-outline">
              <span>Pour s'inscrire, choisissez un plan.</span>
            </div>
          </div>
        ) : null}
      </div>
      {/*card price*/}

      <ul
        className={
          "relative w-full max-w-[1300px] mx-auto py-[50px] flex flex-col justify-start items-center gap-[100px] lg:flex-row lg:justify-between lg:gap-[0px]"
        }
      >
        {planOptions.map((items) => {
          return (
            <li key={items.name} className={"max-w-[350px] min-w-[300px]"}>
              <PriceCard lang={textLangCard} option={items} />
            </li>
          );
        })}
      </ul>

      {/* tableau de comparaison*/}
      <div
        className={"w-full max-w-[1300px] mx-auto py-[50px] "}
      >
        <h2
          className={
            "font-bold text-3xl text-center text-info lg:text-left lg:self-start"
          }
        >
          {t("pricing.title_h2_tab")}
        </h2>
        <PricingComparisonTable lang={textLangTab} option={planOptions} />
      </div>

      {/* FAQ*/}
      <div
        className={
          "w-full max-w-[1300px] mx-auto py-[50px] flex flex-col justify-start items-center"
        }
      >
        <h2
          className={
            "font-bold text-3xl text-center text-info lg:text-left lg:self-start"
          }
        >
          {t("pricing.title_h2_faq")}
        </h2>
        <Faq text={textLangFaq} />
      </div>
    </div>
  );
}

export { PricePage };
