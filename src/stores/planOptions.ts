import { signal } from "@preact/signals";

export type PlanOption = {
  active?: boolean;
  name: string;
  price: number;
  prices?: Record<"CHF" | "EUR" | "USD", number>;
  stripePriceIds?: Record<"CHF" | "EUR" | "USD", string>;
  credit_IA: number;
  credit_conversion: string;
  size_max?: string;
  tools_qt: string;
  tool_name: string[];
  format: string;
  remove_bg: boolean;
  change_bg_color: boolean;
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

const planOptionsSignal = signal<PlanOption[]>([]);

const setPlanOptions = (plans: PlanOption[]) => {
  planOptionsSignal.value = plans;
};

const clearPlanOptions = () => {
  planOptionsSignal.value = [];
};

export { planOptionsSignal, setPlanOptions, clearPlanOptions };
