import Stripe from "stripe";

const isProd =
  process.env.NODE_ENV === "production" &&
  process.env.STRIPE_MODE === "production";

const resolveStripeApiKey = (): string | null => {
  const key = isProd
    ? process.env.STRIPE_SECRET_KEY_PROD ?? null
    : process.env.STRIPE_SECRET_KEY_TEST ?? null;
  return key && key.trim().length > 0 ? key.trim() : null;
};

export function getStripeClient(): Stripe | null {
  const apiKey = resolveStripeApiKey();
  if (!apiKey) return null;
  return new Stripe(apiKey, {
    // Keep a stable API version across the codebase (webhook already uses 2023-10-16)
    apiVersion: "2023-10-16",
  });
}
