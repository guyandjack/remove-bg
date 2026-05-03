import type { RequestHandler } from "express";
import { logger } from "../../logger.ts";
import { getStripeClient } from "../../function/stripe/stripeClient.ts";
import {
  getActiveSubscription,
  getPlanByCode,
  getUserByEmail,
  updateSubscription,
  createStripeCheckoutSessionState,
} from "../../DB/queriesSQL/queriesSQL.ts";
import { resolvePlanChangeType } from "../../services/subscription/planChange.ts";
import { createCheckoutSession } from "../../function/stripe/createCheckoutSession.ts";
import { planOption } from "../../data/planOption.ts";

function resolveLocale(input: unknown): "fr" | "en" | "de" | "it" {
  const raw = String(input || "en").toLowerCase();
  return (["fr", "en", "de", "it"].includes(raw) ? raw : "en") as any;
}

type Body = { plan_code?: string; currency?: "CHF" | "EUR" | "USD" };

export const changePlanController: RequestHandler = async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(500).json({ success: false, message: "Stripe is not configured on this server." });
  }

  const langHeader = req.headers["accept-language"];
  const locale = resolveLocale(Array.isArray(langHeader) ? langHeader[0] : langHeader);

  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    return res.status(401).json({ success: false, message: "Unauthenticated." });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) return res.status(404).json({ success: false, message: "User not found." });

  const body = (req.body || {}) as Body;
  const planCode = typeof body.plan_code === "string" ? body.plan_code.trim().toLowerCase() : "";
  if (!planCode) {
    return res.status(400).json({ success: false, message: "Missing plan_code." });
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return res.status(400).json({ success: false, message: "No active subscription found for this account." });
  }

  const targetPlan = await getPlanByCode(planCode);
  if (!targetPlan || targetPlan.is_archived === 1) {
    return res.status(404).json({ success: false, message: "Plan not found." });
  }

  if (String(targetPlan.id) === String(subscription.plan_id)) {
    return res.status(200).json({ success: true, message: locale === "fr" ? "Vous êtes déjà sur ce plan." : "You are already on this plan." });
  }

  // FREE -> paid (no Stripe subscription yet): start a new Stripe subscription via Checkout.
  if (!subscription.stripe_subscription_id) {
    const currency: "CHF" | "EUR" | "USD" =
      body.currency && ["CHF", "EUR", "USD"].includes(body.currency) ? body.currency : "CHF";
    const planCfg = planOption.find((p) => p.name === planCode);
    const priceId = planCfg?.stripePriceIds?.[currency] || "";
    if (!priceId) {
      return res.status(400).json({ success: false, message: "Plan price missing for checkout." });
    }

    const response = await createCheckoutSession({
      priceId,
      email: user.email,
      planCode,
      currency,
    });
    if (response.status !== "success" || !response.redirect || !response.sessionId) {
      return res.status(502).json({ success: false, message: "Unable to create Stripe checkout session." });
    }

    await createStripeCheckoutSessionState({
      sessionId: response.sessionId,
      email: user.email,
      planCode,
      planId: targetPlan.id,
      currencyCode: currency,
    });

    return res.status(200).json({
      success: true,
      flow: "checkout",
      redirectUrl: response.redirect,
      message:
        locale === "fr"
          ? "Paiement requis. Redirection vers Stripe."
          : "Payment required. Redirecting to Stripe.",
    });
  }

  // Determine upgrade/downgrade based on Plan.price (cents)
  const changeType = resolvePlanChangeType({
    currentPlanPrice: Number((subscription as any).plan_price ?? 0),
    targetPlanPrice: Number(targetPlan.price),
  });

  // Resolve Stripe price id for this plan & currency (multi-currency support)
  const currency: "CHF" | "EUR" | "USD" =
    body.currency && ["CHF", "EUR", "USD"].includes(body.currency) ? body.currency : "CHF";
  const planCfg = planOption.find((p) => p.name === planCode);
  const targetStripePriceId = planCfg?.stripePriceIds?.[currency] || "";
  if (!targetStripePriceId) {
    return res.status(400).json({ success: false, message: "Target plan is not linked to Stripe for this currency." });
  }

  // Prevent overlapping pending changes
  if (subscription.pending_plan_id) {
    return res.status(409).json({
      success: false,
      message: locale === "fr" ? "Un changement d’abonnement est déjà en cours." : "A plan change is already pending.",
    });
  }

  // Load Stripe subscription with item id + current_period_end
  const stripeSub: any = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
    expand: ["items.data.price"],
  } as any);

  const item = stripeSub?.items?.data?.[0];
  const subscriptionItemId = item?.id as string | undefined;
  const currentPeriodEndUnix = stripeSub?.current_period_end as number | undefined;
  if (!subscriptionItemId || typeof currentPeriodEndUnix !== "number") {
    logger.error("subscription.change_plan::stripe_subscription_invalid", {
      userId: user.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    });
    return res.status(502).json({ success: false, message: "Unable to read Stripe subscription items." });
  }

  const currentPeriodEnd = new Date(currentPeriodEndUnix * 1000);

  if (changeType === "upgrade") {
    // Immediate upgrade with proration. Do NOT mark plan active in DB until webhook confirms.
    try {
      const updated: any = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        items: [{ id: subscriptionItemId, price: targetStripePriceId }],
        proration_behavior: "create_prorations",
        // Try to invoice & pay immediately (may still require action depending on payment method).
        payment_behavior: "pending_if_incomplete",
        expand: ["latest_invoice.payment_intent", "items.data.price"],
      } as any);

      // Persist pending upgrade; webhook will flip plan_id when Stripe is in sync.
      await updateSubscription(subscription.id, {
        pending_plan_id: targetPlan.id,
        pending_change_type: "upgrade",
        pending_change_effective_at: null,
        stripe_schedule_id: null,
      });

      const piStatus = updated?.latest_invoice?.payment_intent?.status as string | undefined;
      const requiresAction = piStatus === "requires_action" || piStatus === "requires_payment_method";

      return res.status(200).json({
        success: true,
        change_type: "upgrade",
        pending: true,
        requires_action: Boolean(requiresAction),
        payment_intent_status: piStatus ?? null,
        message:
          locale === "fr"
            ? "Upgrade demandé. Le nouveau plan sera activé après confirmation de paiement."
            : "Upgrade requested. The new plan will be activated after payment confirmation.",
      });
    } catch (err: any) {
      logger.error("subscription.change_plan::stripe_upgrade_failed", {
        userId: user.id,
        message: err?.message || String(err),
      });
      return res.status(502).json({ success: false, message: "Stripe update failed." });
    }
  }

  // Downgrade: schedule at end of period (no proration). Use Stripe Subscription Schedule.
  try {
    const schedule: any = await (stripe as any).subscriptionSchedules.create({
      from_subscription: subscription.stripe_subscription_id,
      end_behavior: "release",
    });

    const currentPriceId = item?.price?.id as string | undefined;
    if (!currentPriceId) {
      return res.status(502).json({ success: false, message: "Unable to read current Stripe price." });
    }

    await (stripe as any).subscriptionSchedules.update(schedule.id, {
      phases: [
        {
          start_date: "now",
          end_date: Math.floor(currentPeriodEnd.getTime() / 1000),
          items: [{ price: currentPriceId, quantity: 1 }],
          proration_behavior: "none",
        },
        {
          start_date: Math.floor(currentPeriodEnd.getTime() / 1000),
          items: [{ price: targetStripePriceId, quantity: 1 }],
          proration_behavior: "none",
        },
      ],
    });

    await updateSubscription(subscription.id, {
      pending_plan_id: targetPlan.id,
      pending_change_type: "downgrade",
      pending_change_effective_at: currentPeriodEnd,
      stripe_schedule_id: schedule.id,
    });

    return res.status(200).json({
      success: true,
      change_type: "downgrade",
      pending: true,
      effective_at: currentPeriodEnd.toISOString(),
      message:
        locale === "fr"
          ? "Downgrade programmé à la fin de la période en cours."
          : "Downgrade scheduled for the end of the current period.",
    });
  } catch (err: any) {
    logger.error("subscription.change_plan::stripe_downgrade_failed", {
      userId: user.id,
      message: err?.message || String(err),
    });
    return res.status(502).json({ success: false, message: "Stripe schedule update failed." });
  }
};
