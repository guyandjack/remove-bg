import Stripe from "stripe";
import { logger } from "../../logger.js";

// Stripe mode (keys) and deployment mode (URLs) are 2 distinct concerns.
// In preprod, we often run with `NODE_ENV=production` but `STRIPE_MODE=test`.
const isDevEnv = process.env.NODE_ENV === "development";
const stripeIsProd =
  process.env.NODE_ENV === "production" &&
  process.env.STRIPE_MODE === "production";

const stripeApiKey = stripeIsProd
  ? process.env.STRIPE_SECRET_KEY_PROD ?? null
  : process.env.STRIPE_SECRET_KEY_TEST ?? null;

// Public website base URL used for Stripe redirects (success_url/cancel_url).
// Must point to the FRONTEND origin (not the API).
const resolveWebBaseUrl = (): string | null => {
  const candidates = [
    process.env.PUBLIC_WEB_BASE_URL,
    // Backward-compatible envs already used in this repo
    isDevEnv ? process.env.DOMAIN_URL_DEV : process.env.DOMAIN_URL_PROD,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  if (candidates.length > 0) return candidates[0].replace(/\/+$/, "");

  // Dev-only fallback keeps local DX easy.
  if (isDevEnv) return "http://localhost:5173";

  return null;
};

const stripe = stripeApiKey
  ? new Stripe(stripeApiKey /*, { apiVersion: "2024-06-20" }*/)
  : null;

type CheckoutSessionInput = {
  priceId: string;
  email: string;
  planCode: string;
  currency: "CHF" | "EUR" | "USD";
};

const buildBaseUrl = (): string | null => {
  const base = resolveWebBaseUrl();
  if (!base) return null;

  // Safety net: never send real users to localhost outside dev.
  if (!isDevEnv && /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(base)) {
    return null;
  }

  return base;
};

const createCheckoutSession = async ({
  priceId,
  email,
  planCode,
  currency,
}: CheckoutSessionInput) => {
  if (!stripe) {
    return {
      status: "error",
      message: "code: checkout_1",
    };
  }

  const base = buildBaseUrl();
  if (!base) {
    logger.error("stripe.checkout::missing_web_base_url", {
      nodeEnv: process.env.NODE_ENV,
      stripeMode: process.env.STRIPE_MODE,
      hasPublicWebBaseUrl: Boolean(process.env.PUBLIC_WEB_BASE_URL),
      hasDomainUrlDev: Boolean(process.env.DOMAIN_URL_DEV),
      hasDomainUrlProd: Boolean(process.env.DOMAIN_URL_PROD),
    });
    return {
      status: "error",
      message: "code: checkout_missing_base_url",
    };
  }
  const successUrl = `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/pricing?checkout=cancelled`;

  logger.debug("stripe.checkout::redirect_urls_resolved", {
    nodeEnv: process.env.NODE_ENV,
    stripeMode: process.env.STRIPE_MODE,
    base,
    successUrl,
    cancelUrl,
  });

  try {
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: `${priceId}`,
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: email,
      metadata: {
        email,
        plan_code: planCode,
        currency,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session || !session.url) {
      return {
        status: "error",
        message: "code: checkout_3",
      };
    }

    return {
      status: "success",
      statusCode: 300,
      redirect: session.url,
      sessionId: session.id,
    };
  } catch (e) {
    console.error("erreur creation checkout:", e);
    return {
      status: "error",
      message: "code: checkout_4",
    };
  }
};

export { createCheckoutSession };
