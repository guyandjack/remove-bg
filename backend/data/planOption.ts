//option des differents plans sur 24h
type CurrencyCode = "CHF" | "EUR" | "USD";
type PlanOptionInput = {
  name: string;
  price: number;
  prices: Record<CurrencyCode, number>;
  stripePriceIds: Record<CurrencyCode, string>;
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

const planOption: PlanOptionInput[] = [
  {
    name: "free",
    price: 0,
    prices: {
      CHF: 0,
      EUR: 0,
      USD: 0,
    },
    stripePriceIds: {
      CHF: "",
      EUR: "",
      USD: "",
    },
    credit: 5,
    format: ".png",
    remove_bg: true,
    change_bg_color: true,
    tools_qt: "1/6",
    tool_name: ["resize", "ajust"],
    model_IA_ressource: "50%",
    gomme_magique: false,
    img_pexels: false,
    delay_improved: false,
    bg_IA_generation: false,
    bundle: false,
    bundle_qt: 0,
    api: false,
    api_external: false,
  },
  {
    name: "hobby",
    price: 5,
    prices: {
      CHF: 5,
      EUR: 4.5,
      USD: 5.5,
    },
    stripePriceIds: {
      CHF: "price_1SeepuBaVLyPBDGsvlWmRxVS",
      EUR: "price_1SeepuBaVLyPBDGstF3a5O0B",
      USD: "price_1SeepuBaVLyPBDGsqbUSD123",
    },
    credit: 50,
    format: ".png",
    remove_bg: true,
    change_bg_color: true,
    tools_qt: "3/6",
    tool_name: ["resize", "ajust", "finetune"],
    model_IA_ressource: "80%",
    gomme_magique: true,
    img_pexels: true,
    delay_improved: false,
    bg_IA_generation: false,
    bundle: false,
    bundle_qt: 0,
    api: false,
    api_external: false,
  },
  {
    name: "pro",
    price: 10,
    prices: {
      CHF: 10,
      EUR: 9.5,
      USD: 11,
    },
    stripePriceIds: {
      CHF: "price_1SeesUBaVLyPBDGsDf8RNfE7",
      EUR: "price_1SefFxBaVLyPBDGsZ8puzEiW",
      USD: "price_1SeesUBaVLyPBDGsUSD45678",
    },
    credit: 300,
    format: ".png .jpg .webp",
    remove_bg: true,
    change_bg_color: true,
    tools_qt: "6/6",
    tool_name: [
      "resize",
      "ajust",
      "finetune",
      "filter",
      "watermark",
      "annotate",
    ],
    model_IA_ressource: "100%",
    gomme_magique: true,
    img_pexels: true,
    delay_improved: true,
    bg_IA_generation: true,
    bundle: true,
    bundle_qt: 50,
    api: true,
    api_external: true,
  },
];

export { planOption };
