//option des differents plans sur 24h
import { logger } from "../logger.js";

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

// Stripe mode (keys) and deployment mode are distinct concerns:
// - In preprod we often run with `NODE_ENV=production` but `STRIPE_MODE=test`.
// - The server uses LIVE keys only when BOTH are set to "production".
const stripeIsLive =
  process.env.NODE_ENV === "production" &&
  process.env.STRIPE_MODE === "production";

const readEnv = (key: string): string => {
  const v = process.env[key];
  return typeof v === "string" ? v.trim() : "";
};

const isStripePriceId = (value: string): boolean =>
  // Stripe Price IDs look like: price_...
  /^price_[A-Za-z0-9_]+$/.test(value);

const resolveStripePriceId = (keys: {
  live: string;
  test: string;
}): string => {
  const candidate = stripeIsLive ? readEnv(keys.live) : readEnv(keys.test);
  if (!candidate) return "";
  return isStripePriceId(candidate) ? candidate : "";
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
      // Legacy env vars (kept for backward-compatibility):
      // - live: PRICE_ID_CH_PROD / PRICE_ID_EUR_PROD / PRICE_ID_USA_PROD
      // - test: PRICE_ID_CH_DEV / PRICE_ID_EUR_DEV / PRICE_ID_USA_DEV
      // Note: some setups use "USA" for USD in env names; we keep that convention here.
      CHF: resolveStripePriceId({ live: "PRICE_ID_CH_PROD", test: "PRICE_ID_CH_DEV" }),
      EUR: resolveStripePriceId({ live: "PRICE_ID_EUR_PROD", test: "PRICE_ID_EUR_DEV" }),
      USD: resolveStripePriceId({ live: "PRICE_ID_USA_PROD", test: "PRICE_ID_USA_DEV" }),
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
      // Pro plan is currently inactive. Prefer wiring it via dedicated env vars before enabling it:
      // - live: PRICE_ID_PRO_CH_PROD / PRICE_ID_PRO_EUR_PROD / PRICE_ID_PRO_USD_PROD
      // - test: PRICE_ID_PRO_CH_DEV / PRICE_ID_PRO_EUR_DEV / PRICE_ID_PRO_USD_DEV
      // If not set, it stays disabled (empty ids) to avoid TEST/LIVE mismatches.
      CHF: resolveStripePriceId({ live: "PRICE_ID_PRO_CH_PROD", test: "PRICE_ID_PRO_CH_DEV" }),
      EUR: resolveStripePriceId({ live: "PRICE_ID_PRO_EUR_PROD", test: "PRICE_ID_PRO_EUR_DEV" }),
      USD: resolveStripePriceId({ live: "PRICE_ID_PRO_USD_PROD", test: "PRICE_ID_PRO_USD_DEV" }),
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

// Fail fast in LIVE mode if a paid/active plan is missing Stripe IDs.
// In TEST mode, keep the server booting but log a warning (DX).
(() => {
  const paidActivePlans = planOption.filter((p) => p.active && Number(p.price) > 0);
  const missing = paidActivePlans.flatMap((p) => {
    const missingCurrencies = (Object.keys(p.stripePriceIds) as CurrencyCode[]).filter(
      (c) => !p.stripePriceIds[c]
    );
    return missingCurrencies.length ? [{ plan: p.name, missingCurrencies }] : [];
  });

  if (missing.length === 0) return;

  const payload = {
    nodeEnv: process.env.NODE_ENV,
    stripeMode: process.env.STRIPE_MODE,
    missing,
  };

  if (stripeIsLive) {
    // Throwing here prevents a partially configured LIVE server from running and charging users incorrectly.
    throw new Error(`Stripe Price IDs misconfigured for active paid plan(s): ${JSON.stringify(payload)}`);
  }

  logger.warn("planOption::stripe_price_ids_missing", payload);
})();

export { planOption };
