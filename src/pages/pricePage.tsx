//import des hooks
import { useEffect, useState, useRef } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { useLocation } from "preact-iso";

//import des instance
import { api } from "@/utils/axiosConfig";

//import des composant enfants
import { PriceCard } from "@/components/card/priceCard";
import { PricingComparisonTable } from "@/components/table/PriceTable";
import {Faq} from "@/components/faq/faq"

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

type PlanOption = {
  name: string;
  price: number;
  credit: number;
  format: string;
  remove_bg: boolean;
  change_bg_color: boolean;
  tools_qt: string;
  tool_name: string[];
  model_IA_ressource: string;
  gomme_magique: boolean;
  img_pexels: boolean;
  delay_improved: boolean;
  bg_IA_generation: boolean;
  bundle: boolean;
  bundle_qt: number;
  api: boolean;
  api_external: boolean;
};

function PricePage() {
  const { t } = useTranslation();
  const { path } = useLocation();
  const [arrayOption, setArrayOption] = useState<PlanOption[]>([]);
  const [objectOption, setObjectOption] = useState<Record<string, PlanOption>>(
    {}
  );

  const IsCreateAccount = path.includes("signup") ? true : false;

  const textLangCard: PlanText = {
    tag:t("priceCard.tag"),
    remove_bg: t("priceCard.remove_bg"),
    price: t("priceCard.price"),
    credit: t("priceCard.credit"),
    gomme_magique: t("priceCard.gomme_magique"),
    Image_pexels: t("priceCard.img_pexels"),
    api: t("priceCard.api"),
    bundle: t("priceCard.bundle"),
    subscribe:t("priceCard.subscribe")
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
    { question: t("faqPricing.question_1"), response: t("faqPricing.reponse_1") },
    { question: t("faqPricing.question_2"), response: t("faqPricing.reponse_2") },
    { question: t("faqPricing.question_3"), response: t("faqPricing.reponse_3") },
    { question: t("faqPricing.question_4"), response: t("faqPricing.reponse_4") },
    { question: t("faqPricing.question_5"), response: t("faqPricing.reponse_5") },
    { question: t("faqPricing.question_6"), response: t("faqPricing.reponse_6") },
    { question: t("faqPricing.question_7"), response: t("faqPricing.reponse_7") },
    { question: t("faqPricing.question_8"), response: t("faqPricing.reponse_8") },
    { question: t("faqPricing.question_9"), response: t("faqPricing.reponse_9") },
    { question: t("faqPricing.question_10"), response: t("faqPricing.reponse_10") },
  ];

  useEffect(() => {
    if (localStorage.getItem("option")) {
      const objectOption = localStorage.getItem("option") || "";
      const objectOptionParsed = JSON.parse(objectOption) || "";
      setArrayOption(objectOptionParsed);
      const byName: Record<string, PlanOption> = objectOptionParsed.reduce(
        (acc, p) => ({ ...acc, [p.name]: p }),
        {}
      );
      setObjectOption(byName);
      return
    }
    api
      .get("api/plan/option")
      .then((result) => {
        const data = result.data;
        if (data.status !== "success") {
          return;
        }
        const plans: PlanOption[] = data.plans;
        localStorage.setItem("option", JSON.stringify(plans));
        setArrayOption(plans);
        const byName: Record<string, PlanOption> = plans.reduce(
          (acc, p) => ({ ...acc, [p.name]: p }),
          {}
        );
        setObjectOption(byName);
      })
      .catch((e) => {
        //setPlanOption([]);
      });
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
          <div className={"absolute top-[-30px] left-[10px] z-10"}>
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
        {arrayOption.map((items) => {
          return (
            <li key={items.name} className={"max-w-[350px] min-w-[300px]"}>
              <PriceCard lang={textLangCard} option={items} />
            </li>
          );
        })}
      </ul>

      {/* tableau de comparaison*/}
      <div className={"w-full max-w-[1300px] mx-auto py-[50px] "}>
        <h2
          className={
            "font-bold text-3xl text-center text-info lg:text-left lg:self-start"
          }
        >
          {t("pricing.title_h2_tab")}
        </h2>
        <PricingComparisonTable lang={textLangTab} option={arrayOption} />
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
