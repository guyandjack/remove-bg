//import des hooks
import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";

//import des instance
import { api } from "@/utils/axiosConfig";
import { setSessionFromApiResponse } from "@/stores/session";

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
import { setActiveLink } from "@/utils/setActiveLink";
import { navigateWithLink } from "@/utils/navigateWithLink";


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

type CurrencyCode = "CHF" | "EUR" | "USD";
const currencySymbols: Record<CurrencyCode, string> = {
  CHF: "CHF",
  EUR: "€",
  USD: "$",
};

const  PricePage = ({ routeKey = "", isSignup = false }: PricePageProps)=> {
  const { t } = useTranslation();
  const planOptions = planOptionsSignal.value;
  const [currency, setCurrency] = useState<CurrencyCode>("CHF");
  const [finalizeStatus, setFinalizeStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null);

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
    setActiveLink();
    setDocumentTitle();
    const params = new URLSearchParams(window.location.search);
    const requestedCurrency = params.get("currency");
    if (
      requestedCurrency &&
      ["CHF", "EUR", "USD"].includes(requestedCurrency.toUpperCase())
    ) {
      setCurrency(requestedCurrency.toUpperCase() as CurrencyCode);
    }
  }, [routeKey]);

  const finalizeCheckout = async (sessionId: string, attempt = 0) => {
    try {
      setFinalizeStatus("pending");
      setFinalizeMessage("Validation du paiement en cours...");
      const { data } = await api.post(
        "api/stripe/finalize",
        { sessionId },
        { withCredentials: true }
      );

      if (data?.status === "pending") {
        if (attempt < 5) {
          setTimeout(() => finalizeCheckout(sessionId, attempt + 1), 1500);
        } else {
          setFinalizeStatus("error");
          setFinalizeMessage(
            "La confirmation Stripe prend plus de temps que prévu. Réessayez dans quelques secondes."
          );
        }
        return;
      }

      if (data?.status !== "success") {
        setFinalizeStatus("error");
        setFinalizeMessage(
          data?.message ||
            "Impossible de valider votre paiement. Merci de réessayer."
        );
        return;
      }

      setSessionFromApiResponse(data);
      setFinalizeStatus("success");
      setFinalizeMessage("Votre abonnement est actif, redirection en cours.");
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      url.searchParams.delete("userValide");
      window.history.replaceState({}, "", url.toString());
      setTimeout(() => {
        navigateWithLink("/services");
      }, 2000);
    } catch (error) {
      setFinalizeStatus("error");
      setFinalizeMessage(
        "Une erreur est survenue pendant la validation du paiement."
      );
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const userValidated = params.get("userValide");

    if (userValidated === "true" && sessionId && finalizeStatus === "idle") {
      finalizeCheckout(sessionId);
    }
  }, [routeKey, finalizeStatus]);

  return (
    <div className={"page-container"}>
      <div
        className={
          "relative w-full mx-auto max-w-[1300px] py-[50px] px-[10px] flex flex-col justify-start items-center gap-[30px] "
        }
      >
        {finalizeStatus !== "idle" ? (
          <div className={"absolute top-[-50px] left-0 right-0 mx-auto max-w-[600px]"}>
            <div
              role="alert"
              className={`alert ${
                finalizeStatus === "success"
                  ? "alert-success"
                  : finalizeStatus === "error"
                  ? "alert-error"
                  : "alert-info"
              }`}
            >
              <span>{finalizeMessage}</span>
            </div>
          </div>
        ) : null}
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
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-base font-semibold">
            {t("pricing.currency_label") || "Devise"}
          </span>
          <div className="join">
            {(["CHF", "EUR", "USD"] as CurrencyCode[]).map((code) => (
              <button
                key={code}
                type="button"
                className={`btn btn-sm join-item ${
                  currency === code ? "btn-primary" : "btn-outline"
                }`}
                onClick={() => {
                  setCurrency(code);
                  const url = new URL(window.location.href);
                  url.searchParams.set("currency", code);
                  window.history.replaceState({}, "", url.toString());
                }}
              >
                {currencySymbols[code]}
              </button>
            ))}
          </div>
        </div>
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
              <PriceCard lang={textLangCard} option={items} currency={currency} />
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
        <PricingComparisonTable lang={textLangTab} option={planOptions} currency={currency} />
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
