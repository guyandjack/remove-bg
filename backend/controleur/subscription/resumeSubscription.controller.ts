import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import { getStripeClient } from "../../function/stripe/stripeClient.js";
import {
  getActiveSubscription,
  getUserByEmail,
  updateSubscription,
} from "../../DB/queriesSQL/queriesSQL.js";

function resolveLocale(input: unknown): "fr" | "en" | "de" | "it" {
  const raw = String(input || "en").toLowerCase();
  return (["fr", "en", "de", "it"].includes(raw) ? raw : "en") as any;
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const resumeSubscriptionController: RequestHandler = async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(500).json({
      success: false,
      message: "Stripe is not configured on this server.",
    });
  }

  const langHeader = req.headers["accept-language"];
  const locale = resolveLocale(Array.isArray(langHeader) ? langHeader[0] : langHeader);

  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    return res.status(401).json({ success: false, message: "Unauthenticated." });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription || !subscription.stripe_subscription_id) {
    return res.status(400).json({
      success: false,
      message: "No active Stripe subscription found for this account.",
    });
  }

  // If already active & not canceling, nothing to do.
  if (subscription.status === "active" && subscription.stripe_cancel_at_period_end !== 1) {
    const accessUntil = subscription.plan_access_until ?? subscription.current_period_end ?? subscription.period_end;
    const accessUntilDate = new Date(accessUntil);
    return res.status(200).json({
      success: true,
      subscription_status: "active",
      plan_access_until: formatIsoDate(accessUntilDate),
      plan_access_until_iso: accessUntilDate.toISOString(),
      message:
        locale === "fr"
          ? "Votre abonnement est déjà actif."
          : "Your subscription is already active.",
    });
  }

  // Resume: cancel_at_period_end=false
  try {
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
  } catch (err: any) {
    logger.error("subscription.resume::stripe_update_failed", {
      userId: user.id,
      subscriptionId: subscription.id,
      message: err?.message || String(err),
    });
    return res.status(502).json({ success: false, message: "Stripe update failed." });
  }

  let stripeSub: any = null;
  try {
    stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  } catch (err: any) {
    logger.error("subscription.resume::stripe_retrieve_failed", {
      userId: user.id,
      subscriptionId: subscription.id,
      message: err?.message || String(err),
    });
  }

  const cancelAtPeriodEnd = Boolean((stripeSub as any)?.cancel_at_period_end);
  const currentPeriodEndUnix = (stripeSub as any)?.current_period_end;
  const currentPeriodEnd =
    typeof currentPeriodEndUnix === "number" ? new Date(currentPeriodEndUnix * 1000) : null;

  if (cancelAtPeriodEnd || !currentPeriodEnd) {
    logger.error("subscription.resume::stripe_response_invalid", {
      userId: user.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      cancelAtPeriodEndRaw: (stripeSub as any)?.cancel_at_period_end,
      currentPeriodEndUnix,
    });
    return res.status(502).json({
      success: false,
      message: "Stripe response is missing cancel_at_period_end/current_period_end.",
    });
  }

  await updateSubscription(subscription.id, {
    status: "active",
    stripe_cancel_at_period_end: 0,
    current_period_end: currentPeriodEnd,
    plan_access_until: currentPeriodEnd,
    cancel_at: null,
  });

  return res.status(200).json({
    success: true,
    subscription_status: "active",
    plan_access_until: formatIsoDate(currentPeriodEnd),
    plan_access_until_iso: currentPeriodEnd.toISOString(),
    message:
      locale === "fr"
        ? "Votre abonnement a été réactivé."
        : "Your subscription has been reactivated.",
  });
};

