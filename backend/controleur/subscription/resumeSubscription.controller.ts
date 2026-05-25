import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import { getStripeClient } from "../../function/stripe/stripeClient.js";
import {
  formatBillingLockMessage,
  getStripeBillingLock,
} from "../../function/stripe/stripeBillingGuards.js";
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
    logger.error("subscription.resume::stripe_not_configured", {
      code: "ctrl_resumeSubscription_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(500).json({
      success: false,
      message: "Stripe is not configured on this server.",
      code: "ctrl_resumeSubscription_err1",
      requestId: (req as any).requestId,
    });
  }

  const langHeader = req.headers["accept-language"];
  const locale = resolveLocale(Array.isArray(langHeader) ? langHeader[0] : langHeader);

  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    logger.warn("subscription.resume::unauthenticated_missing_payload", {
      code: "ctrl_resumeSubscription_err2",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(401).json({
      success: false,
      message: "Unauthenticated.",
      code: "ctrl_resumeSubscription_err2",
      requestId: (req as any).requestId,
    });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    logger.warn("subscription.resume::user_not_found", {
      code: "ctrl_resumeSubscription_err3",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      email: String(email),
    });
    return res.status(404).json({
      success: false,
      message: "User not found.",
      code: "ctrl_resumeSubscription_err3",
      requestId: (req as any).requestId,
    });
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription || !subscription.stripe_subscription_id) {
    logger.warn("subscription.resume::no_active_stripe_subscription", {
      code: "ctrl_resumeSubscription_err4",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: user.id,
    });
    return res.status(400).json({
      success: false,
      message: "No active Stripe subscription found for this account.",
      code: "ctrl_resumeSubscription_err4",
      requestId: (req as any).requestId,
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
    const lock = await getStripeBillingLock({
      stripe,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    });
    if (lock.locked) {
      logger.warn("subscription.resume::billing_locked", {
        code: "ctrl_resumeSubscription_err5",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
      });
      return res.status(409).json({
        success: false,
        message: formatBillingLockMessage({ locale, lock }),
        code: "ctrl_resumeSubscription_err5",
        requestId: (req as any).requestId,
      });
    }

    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
  } catch (err: any) {
    logger.error("subscription.resume::stripe_update_failed", {
      code: "ctrl_resumeSubscription_err6",
      userId: user.id,
      subscriptionId: subscription.id,
      message: err?.message || String(err),
    });
    return res.status(502).json({
      success: false,
      message: "Stripe update failed.",
      code: "ctrl_resumeSubscription_err6",
      requestId: (req as any).requestId,
    });
  }

  let stripeSub: any = null;
  try {
    stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  } catch (err: any) {
    logger.error("subscription.resume::stripe_retrieve_failed", {
      code: "ctrl_resumeSubscription_err7",
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
      code: "ctrl_resumeSubscription_err8",
      userId: user.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      cancelAtPeriodEndRaw: (stripeSub as any)?.cancel_at_period_end,
      currentPeriodEndUnix,
    });
    return res.status(502).json({
      success: false,
      message: "Stripe response is missing cancel_at_period_end/current_period_end.",
      code: "ctrl_resumeSubscription_err8",
      requestId: (req as any).requestId,
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

