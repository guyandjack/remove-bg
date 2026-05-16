//option des differents plans sur 24h
type CurrencyCode = "CHF" | "EUR" | "USD";
type PlanOptionInput = {
  active: boolean;
  name: string;
  price: number;
  prices: Record<CurrencyCode, number>;
  stripePriceIds: Record<CurrencyCode, string>;
  credit_IA: number;
  credit_conversion: string;
  img_input: string;
  img_output: string;
  remove_bg: boolean;
  change_bg_color: boolean;
  tools_qt: string;
  tool_name: string[];
  model_IA_ressource: string;
  gomme_magique?: boolean;
  img_pexels?: boolean;
  use_sale: boolean;
  delay_improved?: boolean;
  bg_IA_generation?: boolean;
  bundle?: boolean;
  bundle_qt?: number;
  api?: boolean;
  api_external?: boolean;
};

const planOption: PlanOptionInput[] = [
  // Visitor (non connecte) - expose via API for frontend limits,
  // but must not appear on pricing page (active: false).
  {
    active: false,
    name: "visitor",
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
    model_IA_ressource: "std",
    credit_IA: 100,

    credit_conversion: "100",
    img_input: "5Mb",
    img_output: "512px",
    remove_bg: true,
    change_bg_color: false,
    tools_qt: "0/6",
    tool_name: [],
    gomme_magique: false,
    img_pexels: false,
    use_sale: false,
  },
  {
    active: true,
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

    model_IA_ressource: "std",
    credit_IA: 8,
    credit_conversion: "15",
    img_input: "5Mb",
    img_output: "512 px",
    remove_bg: true,
    change_bg_color: true,
    tools_qt: "2/6",
    tool_name: ["resize", "ajust"],
    gomme_magique: false,
    img_pexels: false,
    use_sale: true,
    // delay_improved: false,
    //bg_IA_generation: false,
    //bundle: false,
    //bundle_qt: 0,
    //api: false,
    //api_external: false,
  },
  {
    active: true,
    name: "hobby",
    price: 4.99,
    prices: {
      CHF: 4.99,
      EUR: 4.99,
      USD: 4.99,
    },
    stripePriceIds: {
      CHF: "price_1SeepuBaVLyPBDGsvlWmRxVS",
      EUR: "price_1SeepuBaVLyPBDGstF3a5O0B",
      USD: "price_1Sez7zBaVLyPBDGsMMgFL0D1",
    },
    model_IA_ressource: "improved",
    credit_IA: 150,
    credit_conversion: "150",
    img_input: "10Mb",
    img_output: "1080 px",
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

    //gomme_magique: false,
    img_pexels: true,
    use_sale: true,
    //delay_improved: false,
    //bg_IA_generation: false,
    //bundle: false,
    //bundle_qt: 0,
    //api: false,
    //api_external: false,
  },
  {
    active: false,
    name: "pro",
    price: 10,
    prices: {
      CHF: 10,
      EUR: 10,
      USD: 10,
    },
    stripePriceIds: {
      CHF: "price_1SeesUBaVLyPBDGsDf8RNfE7",
      EUR: "price_1SefFxBaVLyPBDGsZ8puzEiW",
      USD: "price_1Sez6YBaVLyPBDGsWE3ErOdv",
    },
    model_IA_ressource: "pro",
    credit_IA: 300,
    credit_conversion: "300",
    img_input: "15Mb",
    img_output: "1080 px",
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
    gomme_magique: true,
    img_pexels: true,
    use_sale: true,
    delay_improved: true,
    bg_IA_generation: true,
    bundle: true,
    bundle_qt: 50,
    api: true,
    api_external: true,
  },
];

export { planOption };
