//import des hooks
import { useTranslation } from "react-i18next";
import {useLocation } from "preact-iso"

//import des composant enfants
import { PriceCard } from "@/components/card/priceCard"; 

type PlanKey = "tag" | "title" | "price" | "bg" | "resolution" | "format" | "credit" | "tool_1" | "tool_2" | "subscribe" | "bill" ;
 

function PricePage() {
  const { t } = useTranslation();
  const {path} = useLocation();
  const IsCreateAccount = path.includes("signup") ? true : false;
  const billHobby = 12 * 5;
  const billPro = 12 * 15;
  const freePlan: Record<PlanKey, string> = {
    tag: t("priceCard.free_plan.tag") || "",
    title: t("priceCard.free_plan.title"),
    price: t("priceCard.free_plan.price"),
    bg: t("priceCard.free_plan.bg"),
    resolution: t("priceCard.free_plan.resolution"),
    format: t("priceCard.free_plan.format"),
    credit: t("priceCard.free_plan.credit"),
    tool_1: "",
    tool_2: "",
    subscribe: t("priceCard.free_plan.subscribe"),
    bill: t("priceCard.free_plan.bill") + " 0 $",
  };
  const hobbyPlan: Record<PlanKey, string> = {
    tag: t("priceCard.hobby_plan.tag") || "",
    title: t("priceCard.hobby_plan.title"),
    price: t("priceCard.hobby_plan.price"),
    bg: t("priceCard.hobby_plan.bg"),
    resolution: t("priceCard.hobby_plan.resolution"),
    format: t("priceCard.hobby_plan.format"),
    credit: t("priceCard.hobby_plan.credit"),
    tool_1: t("priceCard.hobby_plan.tool_1"),
    tool_2: "",
    subscribe: t("priceCard.hobby_plan.subscribe"),
    bill: t("priceCard.hobby_plan.bill") + " " + `${billHobby}` + " $",
  };
  const proPlan: Record<PlanKey, string> = {
    tag: t("priceCard.pro_plan.tag") || "",
    title: t("priceCard.pro_plan.title"),
    price: t("priceCard.pro_plan.price"),
    bg: t("priceCard.pro_plan.bg"),
    resolution: t("priceCard.pro_plan.resolution"),
    format: t("priceCard.pro_plan.format"),
    credit: t("priceCard.pro_plan.credit"),
    tool_1: t("priceCard.pro_plan.tool_1"),
    tool_2: t("priceCard.pro_plan.tool_2"),
    subscribe: t("priceCard.pro_plan.subscribe"),
    bill: t("priceCard.pro_plan.bill") + " " + `${billPro}` + " $",
  };

 
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
            __html: t("pricing.title_h2").replace(/\n/g, "<br/>"),
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
      <ul
        className={
          "w-full max-w-[1300px] mx-auto py-[50px] flex flex-col justify-start items-center gap-[100px] lg:flex-row lg:justify-between lg:gap-[0px]"
        }
      >
        <li>
          <PriceCard plan={freePlan} />
        </li>
        <li>
          <PriceCard plan={hobbyPlan} />
        </li>
        <li>
          <PriceCard plan={proPlan} />
        </li>
      </ul>
    </div>
  );
}

export { PricePage };
