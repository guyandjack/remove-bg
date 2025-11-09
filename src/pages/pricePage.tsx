//import des hooks
import { useTranslation } from "react-i18next";

//import des composant enfants
import { PriceCard } from "@/components/card/priceCard"; 

type PlanKey = "tag" | "title" | "price" | "bg" | "resolution" | "format" | "credit" | "tool_1" | "tool_2" | "subscribe" | "bill" ;
 

function PricePage() {
  const { t } = useTranslation();
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
    <div className={"w-full mx-auto"}>
      <div
        className={
          "py-[50px] flex flex-col justify-start items-center gap-[30px]"
        }
      >
        <h1 className={"mx-auto text-3xl"}>
          {t("pricing.title_h1")}
        </h1>
        <h2 className={"mx-auto text-2xl"}>
          {t("pricing.title_h2")}
        </h2>
        <p className={"mx-auto text-xl"}>
          {t("pricing.intro")}
          
        </p>
      </div>
      <div
        className={
          "py-[100px] flex flex-col justify-start items-center gap-[30px] lg:flex-row lg:justify-evenly"
        }
      >
        <PriceCard plan={freePlan} />
        <PriceCard plan={hobbyPlan} />
        <PriceCard plan={proPlan} />
      </div>
    </div>
  );
}

export { PricePage };
