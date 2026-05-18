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
  ? new Stripe(stripeApiKey, {
      // Keep a stable API version across the codebase (webhook/client use 2023-10-16)
      apiVersion: "2023-10-16",
    })
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

  // Stripe requires absolute URLs. In production-like deployments we should use HTTPS.
  // (Stripe may reject http:// in live mode; using https:// also avoids mixed-content issues.)
  if (!isDevEnv && !/^https:\/\//i.test(base)) {
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
      hint: "Stripe is not configured (missing secret key).",
    };
  }

  const base = buildBaseUrl();
  if (!base) {
    logger.error("stripe.checkout::invalid_web_base_url", {
      nodeEnv: process.env.NODE_ENV,
      stripeMode: process.env.STRIPE_MODE,
      hasDomainUrlDev: Boolean(process.env.DOMAIN_URL_DEV),
      hasDomainUrlProd: Boolean(process.env.DOMAIN_URL_PROD),
      domainUrlDev: process.env.DOMAIN_URL_DEV || null,
      domainUrlProd: process.env.DOMAIN_URL_PROD || null,
    });
    return {
      status: "error",
      // Keep error stable for frontend while making it diagnosable
      message: "code: checkout_invalid_base_url",
      hint:
        "Invalid redirect base URL. Set DOMAIN_URL_PROD to your FRONTEND origin, in https:// form (example: https://wizpix.ch).",
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
    const err = e as any;
    // Stripe errors are safe to log (they don't include secret keys) and are crucial to debug prod issues.
    logger.error("stripe.checkout::create_session_failed", {
      nodeEnv: process.env.NODE_ENV,
      stripeMode: process.env.STRIPE_MODE,
      planCode,
      currency,
      // priceId is not secret (it is visible client-side in many setups), but still useful for diagnosis.
      priceId,
      successUrl,
      cancelUrl,
      stripeErrorType: err?.type ?? null,
      stripeErrorCode: err?.code ?? null,
      stripeErrorMessage: err?.message ?? String(err),
      stripeErrorParam: err?.param ?? null,
      stripeRequestId: err?.requestId ?? null,
      stripeStatusCode: err?.statusCode ?? null,
    });

    const stripeMessage = String(err?.message || "");
    let hint = "";
    // Common production pitfalls
    if (
      /no such price/i.test(stripeMessage) ||
      err?.code === "resource_missing"
    ) {
      hint =
        "Stripe can't find this Price ID. Most often this is a TEST/LIVE mismatch: verify STRIPE_MODE and that planOption.stripePriceIds match the Stripe account/key used by this server.";
    } else if (/https/i.test(stripeMessage) && /url/i.test(stripeMessage)) {
      hint =
        "Stripe rejected redirect URLs. Verify DOMAIN_URL_PROD is an absolute https:// URL pointing to the frontend origin (not the API).";
    } else {
      // Avoid leaking raw Stripe error messages to end-users; keep it actionable for support.
      const requestId = err?.requestId ? String(err.requestId) : "";
      hint = requestId
        ? `Stripe checkout creation failed (requestId: ${requestId}). Check server logs for details.`
        : "Stripe checkout creation failed. Check server logs for details.";
    }
    return {
      status: "error",
      message: "code: checkout_4",
      hint,
    };
  }
};

export { createCheckoutSession };
