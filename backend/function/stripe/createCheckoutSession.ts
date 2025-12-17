import Stripe from "stripe";

const isProd =
  process.env.NODE_ENV === "production" &&
  process.env.STRIPE_MODE === "production";

const stripeApiKey = isProd
  ? process.env.STRIPE_SECRET_KEY_PROD ?? null
  : process.env.STRIPE_SECRET_KEY_TEST ?? null;

const domain = isProd
  ? process.env.DOMAIN_URL_PROD ?? null
  : process.env.DOMAIN_URL_DEV ?? null;

const stripe = stripeApiKey
  ? new Stripe(stripeApiKey /*, { apiVersion: "2024-06-20" }*/)
  : null;

type CheckoutSessionInput = {
  priceId: string;
  email: string;
  planCode: string;
  currency: "CHF" | "EUR" | "USD";
};

const buildBaseUrl = () => {
  const fallback = "http://localhost:5173";
  const base = domain && domain.trim().length > 0 ? domain : fallback;
  return base.replace(/\/+$/, "");
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
  const successUrl = `${base}?userValide=true&currency=${currency}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}?userValide=false&session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(
    planCode
  )}&currency=${currency}`;

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
