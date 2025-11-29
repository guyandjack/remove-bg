import { signal } from "@preact/signals";

export type PlanOption = {
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

const planOptionsSignal = signal<PlanOption[]>([]);

const setPlanOptions = (plans: PlanOption[]) => {
  planOptionsSignal.value = plans;
};

const clearPlanOptions = () => {
  planOptionsSignal.value = [];
};

export { planOptionsSignal, setPlanOptions, clearPlanOptions };
