import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import { getStripeClient } from "../../function/stripe/stripeClient.js";
import {
  formatBillingLockMessage,
  getStripeBillingLock,
} from "../../function/stripe/stripeBillingGuards.js";
import {
  getActiveSubscription,
  getPlanById,
  getPlanByCode,
  getPlanByName,
  getUserByEmail,
  listPlans,
  updateSubscription,
  createStripeCheckoutSessionState,
} from "../../DB/queriesSQL/queriesSQL.js";
import { createCheckoutSession } from "../../function/stripe/createCheckoutSession.js";
import { planOption } from "../../data/planOption.js";

function resolveLocale(input: unknown): "fr" | "en" | "de" | "it" {
  const raw = String(input || "en").toLowerCase();
  return (["fr", "en", "de", "it"].includes(raw) ? raw : "en") as any;
}

type CurrencyCode = "CHF" | "EUR" | "USD";
type Body = { plan_code?: string; currency?: CurrencyCode | string };

function normalizePlanCodeInput(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

function normalizePlanCodeAlias(raw: string): string {
  const normalized = normalizePlanCodeInput(raw);
  // Backward-compatibility: some clients historically sent "hoby" (missing a 'b').
  if (normalized === "hoby") return "hobby";
  return normalized;
}

function getPlanOptionByCode(code: string) {
  const normalized = normalizePlanCodeAlias(code);
  return planOption.find((p) => p.name === normalized) ?? null;
}

function normalizeCurrencyCode(input: unknown, fallback: CurrencyCode): CurrencyCode {
  const raw = String(input || "").trim().toUpperCase();
  return (["CHF", "EUR", "USD"].includes(raw) ? raw : fallback) as CurrencyCode;
}

function isStripePriceId(value: string): boolean {
  return /^price_[A-Za-z0-9_]+$/.test(String(value || ""));
}

function resolveStripePriceIdForPlan(params: {
  targetPlan: { code: string; currency_code: string; stripe_price_id: string | null };
  currency: CurrencyCode;
}): { priceId: string; source: "db" | "planOption" } | null {
  // Source of truth: planOption (Stripe Price IDs are wired there via env vars).
  const cfg = getPlanOptionByCode(params.targetPlan.code);
  const priceId = cfg?.stripePriceIds?.[params.currency] || "";
  if (!priceId || !isStripePriceId(priceId)) return null;
  return { priceId, source: "planOption" };
}

function getPlanPriceFromPlanOption(params: {
  planCode: string;
  currency: CurrencyCode;
}): number | null {
  const cfg = getPlanOptionByCode(params.planCode);
  if (!cfg) return null;
  const v = cfg.prices?.[params.currency];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export const changePlanController: RequestHandler = async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    logger.error("subscription.change_plan::stripe_not_configured", {
      code: "ctrl_changePlan_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(500).json({
      success: false,
      message: "Stripe is not configured on this server.",
      code: "ctrl_changePlan_err1",
      requestId: (req as any).requestId,
    });
  }

  const langHeader = req.headers["accept-language"];
  const locale = resolveLocale(Array.isArray(langHeader) ? langHeader[0] : langHeader);

  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    logger.warn("subscription.change_plan::unauthenticated_missing_payload", {
      code: "ctrl_changePlan_err2",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(401).json({
      success: false,
      message: "Unauthenticated.",
      code: "ctrl_changePlan_err2",
      requestId: (req as any).requestId,
    });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    logger.warn("subscription.change_plan::user_not_found", {
      code: "ctrl_changePlan_err3",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      email: String(email),
    });
    return res.status(404).json({
      success: false,
      message: "User not found.",
      code: "ctrl_changePlan_err3",
      requestId: (req as any).requestId,
    });
  }

  const body = (req.body || {}) as Body;
  const rawPlanInput = typeof body.plan_code === "string" ? body.plan_code.trim() : "";
  const planCode = rawPlanInput ? normalizePlanCodeAlias(rawPlanInput) : "";
  if (!rawPlanInput || !planCode) {
    logger.warn("subscription.change_plan::missing_plan_code", {
      code: "ctrl_changePlan_err4",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: user.id,
    });
    return res.status(400).json({
      success: false,
      message: "Missing plan_code.",
      code: "ctrl_changePlan_err4",
      requestId: (req as any).requestId,
    });
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    logger.warn("subscription.change_plan::no_active_subscription", {
      code: "ctrl_changePlan_err5",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: user.id,
    });
    return res.status(400).json({
      success: false,
      message: "No active subscription found for this account.",
      code: "ctrl_changePlan_err5",
      requestId: (req as any).requestId,
    });
  }

  let targetPlan = await getPlanByCode(planCode);
  if (!targetPlan) {
    targetPlan = await getPlanByName(rawPlanInput);
  }

  if (!targetPlan) {
    try {
      const plans = await listPlans(true);
      logger.warn("subscription.change_plan::plan_not_found", {
        code: "ctrl_changePlan_err6",
        userId: user.id,
        requestedPlanInput: rawPlanInput,
        normalizedPlanCode: planCode,
        planCount: plans.length,
        planCodesSample: plans.map((p) => p.code).slice(0, 10),
      });
    } catch (err: any) {
      logger.warn("subscription.change_plan::plan_not_found_debug_failed", {
        code: "ctrl_changePlan_err6",
        userId: user.id,
        requestedPlanInput: rawPlanInput,
        normalizedPlanCode: planCode,
        message: err?.message || String(err),
      });
    }
    return res.status(404).json({
      success: false,
      message: "Plan not found.",
      code: "ctrl_changePlan_err6",
      requestId: (req as any).requestId,
    });
  }

  if (targetPlan.is_archived === 1) {
    logger.warn("subscription.change_plan::plan_archived", {
      code: "ctrl_changePlan_err7",
      userId: user.id,
      planId: targetPlan.id,
      planCode: targetPlan.code,
    });
    return res.status(404).json({
      success: false,
      message: "Plan not found.",
      code: "ctrl_changePlan_err7",
      requestId: (req as any).requestId,
    });
  }

  // Source of truth: planOption. Only allow switching to active plans defined there.
  const targetPlanCode = normalizePlanCodeAlias(targetPlan.code);
  const targetPlanConfig = getPlanOptionByCode(targetPlanCode);
  if (!targetPlanConfig || !targetPlanConfig.active || targetPlanCode === "visitor") {
    logger.warn("subscription.change_plan::plan_not_allowed", {
      code: "ctrl_changePlan_err8",
      userId: user.id,
      targetPlanId: targetPlan.id,
      targetPlanCode: targetPlan.code,
      normalizedTargetPlanCode: targetPlanCode,
      hasPlanOptionConfig: Boolean(targetPlanConfig),
      planOptionActive: targetPlanConfig?.active ?? null,
    });
    return res.status(404).json({
      success: false,
      message: "Plan not found.",
      code: "ctrl_changePlan_err8",
      requestId: (req as any).requestId,
    });
  }

  if (String(targetPlan.id) === String(subscription.plan_id)) {
    return res.status(200).json({ success: true, message: locale === "fr" ? "Vous êtes déjà sur ce plan." : "You are already on this plan." });
  }

  // Current plan (DB + planOption) is needed to decide upgrade/downgrade reliably.
  const currentPlanRow = await getPlanById(subscription.plan_id);
  const currentPlanCode = currentPlanRow ? normalizePlanCodeAlias(currentPlanRow.code) : "";
  const currentPlanConfig = currentPlanRow ? getPlanOptionByCode(currentPlanCode) : null;
  if (!currentPlanRow || !currentPlanConfig) {
    logger.error("subscription.change_plan::current_plan_unmapped", {
      code: "ctrl_changePlan_err9",
      userId: user.id,
      subscriptionId: subscription.id,
      currentPlanId: subscription.plan_id,
      currentPlanCode: currentPlanRow?.code ?? null,
      normalizedCurrentPlanCode: currentPlanCode || null,
    });
    return res.status(500).json({
      success: false,
      message: "Unable to resolve current plan configuration.",
      code: "ctrl_changePlan_err9",
      requestId: (req as any).requestId,
    });
  }

  // FREE -> paid (no Stripe subscription yet): start a new Stripe subscription via Checkout.
  if (!subscription.stripe_subscription_id) {
    if (currentPlanCode !== "free") {
      logger.error("subscription.change_plan::inconsistent_free_flow_state", {
        code: "ctrl_changePlan_err10",
        userId: user.id,
        subscriptionId: subscription.id,
        currentPlanCode,
        targetPlanCode,
      });
      return res.status(409).json({
        success: false,
        message: "Subscription state is inconsistent. Please contact support.",
        code: "ctrl_changePlan_err10",
        requestId: (req as any).requestId,
      });
    }

    const requestedCurrency = normalizeCurrencyCode(body.currency, "CHF");
    const currency = requestedCurrency;

    const resolved = resolveStripePriceIdForPlan({ targetPlan, currency });
    if (!resolved) {
      const planCfg = getPlanOptionByCode(targetPlan.code);
      const planOptionPriceId = planCfg?.stripePriceIds?.[requestedCurrency] || "";
      const hasPlanOptionCurrencyPrice = isStripePriceId(planOptionPriceId);

      logger.warn("subscription.change_plan::missing_stripe_price_for_checkout", {
        code: "ctrl_changePlan_err11",
        userId: user.id,
        targetPlanId: targetPlan.id,
        targetPlanCode: targetPlan.code,
        requestedPlanInput: rawPlanInput,
        normalizedPlanCode: planCode,
        requestedCurrency,
        nodeEnv: process.env.NODE_ENV,
        stripeMode: process.env.STRIPE_MODE,
        hasDbStripePriceId: Boolean(targetPlan.stripe_price_id),
        hasPlanOptionConfig: Boolean(planCfg),
        hasPlanOptionCurrencyPrice,
      });

      return res.status(400).json({
        success: false,
        message: "Plan price missing for checkout.",
        code: "ctrl_changePlan_err11",
        requestId: (req as any).requestId,
      });
    }

    const response = await createCheckoutSession({
      priceId: resolved.priceId,
      email: user.email,
      planCode: targetPlanCode,
      currency,
    });
    if (response.status !== "success" || !response.redirect || !response.sessionId) {
      logger.error("subscription.change_plan::checkout_session_create_failed", {
        code: "ctrl_changePlan_err12",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        targetPlanCode,
        currency,
      });
      return res.status(502).json({
        success: false,
        message: "Unable to create Stripe checkout session.",
        code: "ctrl_changePlan_err12",
        requestId: (req as any).requestId,
      });
    }

    await createStripeCheckoutSessionState({
      sessionId: response.sessionId,
      email: user.email,
      planCode: targetPlanCode,
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

  // Paid -> FREE: cancel Stripe subscription at period end and switch to free when it ends.
  if (normalizePlanCodeAlias(targetPlan.code) === "free") {
    // Prevent overlapping pending changes
    if (subscription.pending_plan_id) {
      logger.warn("subscription.change_plan::pending_change_conflict", {
        code: "ctrl_changePlan_err13",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        subscriptionId: subscription.id,
      });
      return res.status(409).json({
        success: false,
        message: locale === "fr" ? "Un changement d’abonnement est déjà en cours." : "A plan change is already pending.",
      });
    }

    const lock = await getStripeBillingLock({
      stripe,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    });
    if (lock.locked) {
      logger.warn("subscription.change_plan::billing_locked", {
        code: "ctrl_changePlan_err14",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
      });
      return res.status(409).json({
        success: false,
        message: formatBillingLockMessage({ locale, lock }),
        code: "ctrl_changePlan_err14",
        requestId: (req as any).requestId,
      });
    }

    const stripeSub: any = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
      expand: ["items.data.price"],
    } as any);

    const currentPeriodEndUnix = stripeSub?.current_period_end as number | undefined;
    if (typeof currentPeriodEndUnix !== "number") {
      logger.error("subscription.change_plan::stripe_period_end_missing", {
        code: "ctrl_changePlan_err15",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
      });
      return res.status(502).json({
        success: false,
        message: "Unable to read Stripe subscription period end.",
        code: "ctrl_changePlan_err15",
        requestId: (req as any).requestId,
      });
    }
    const currentPeriodEnd = new Date(currentPeriodEndUnix * 1000);

    try {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, { cancel_at_period_end: true } as any);

      // Validation: ensure Stripe confirms cancel_at_period_end=true before persisting local pending downgrade.
      try {
        const refreshed: any = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        if (Boolean(refreshed?.cancel_at_period_end) !== true) {
          logger.warn("subscription.change_plan::stripe_cancel_not_confirmed", {
            code: "ctrl_changePlan_err16",
            requestId: (req as any).requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            userId: user.id,
            stripeSubscriptionId: subscription.stripe_subscription_id,
          });
          return res.status(502).json({
            success: false,
            code: "ctrl_changePlan_err16",
            requestId: (req as any).requestId,
            message:
              locale === "fr"
                ? "Stripe nâ€™a pas confirmÃ© lâ€™annulation Ã  Ã©chÃ©ance. RÃ©essayez."
                : "Stripe did not confirm the scheduled cancellation. Please retry.",
          });
        }
      } catch {
        logger.warn("subscription.change_plan::stripe_cancel_validation_failed", {
          code: "ctrl_changePlan_err17",
          requestId: (req as any).requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          userId: user.id,
          stripeSubscriptionId: subscription.stripe_subscription_id,
        });
        return res.status(502).json({
          success: false,
          code: "ctrl_changePlan_err17",
          requestId: (req as any).requestId,
          message:
            locale === "fr"
              ? "Impossible de valider lâ€™Ã©tat Stripe aprÃ¨s mise Ã  jour."
              : "Unable to validate Stripe state after update.",
        });
      }
    } catch (err: any) {
      logger.error("subscription.change_plan::stripe_cancel_to_free_failed", {
        code: "ctrl_changePlan_err18",
        userId: user.id,
        message: err?.message || String(err),
      });
      return res.status(502).json({
        success: false,
        message: "Stripe cancel failed.",
        code: "ctrl_changePlan_err18",
        requestId: (req as any).requestId,
      });
    }

    await updateSubscription(subscription.id, {
      pending_plan_id: targetPlan.id,
      pending_change_type: "downgrade",
      pending_change_effective_at: currentPeriodEnd,
      stripe_schedule_id: null,
    });

    return res.status(200).json({
      success: true,
      change_type: "downgrade",
      pending: true,
      effective_at: currentPeriodEnd.toISOString(),
      message:
        locale === "fr"
          ? "Passage au plan gratuit programmé à la fin de la période en cours."
          : "Switch to the free plan scheduled for the end of the current period.",
    });
  }

  // Determine upgrade/downgrade based on planOption (source of truth).
  const comparisonCurrency = normalizeCurrencyCode(body.currency, "CHF");
  const currentPlanPrice = getPlanPriceFromPlanOption({
    planCode: currentPlanCode,
    currency: comparisonCurrency,
  });
  const targetPlanPrice = getPlanPriceFromPlanOption({
    planCode: targetPlanCode,
    currency: comparisonCurrency,
  });
  if (currentPlanPrice == null || targetPlanPrice == null) {
    logger.error("subscription.change_plan::price_missing_in_plan_option", {
      code: "ctrl_changePlan_err19",
      userId: user.id,
      currentPlanCode,
      targetPlanCode,
      currency: comparisonCurrency,
    });
    return res.status(500).json({
      success: false,
      message: "Plan configuration error.",
      code: "ctrl_changePlan_err19",
      requestId: (req as any).requestId,
    });
  }
  const changeType = targetPlanPrice > currentPlanPrice ? "upgrade" : "downgrade";

  // Resolve Stripe price id for this plan & currency (multi-currency support)
  const requestedCurrency = normalizeCurrencyCode(body.currency, "CHF");
  const currency = requestedCurrency;

  const resolved = resolveStripePriceIdForPlan({ targetPlan, currency });
  if (!resolved) {
    const planCfg = getPlanOptionByCode(targetPlan.code);
    const planOptionPriceId = planCfg?.stripePriceIds?.[requestedCurrency] || "";
    const hasPlanOptionCurrencyPrice = isStripePriceId(planOptionPriceId);

    logger.warn("subscription.change_plan::missing_stripe_price_for_change", {
      code: "ctrl_changePlan_err20",
      userId: user.id,
      targetPlanId: targetPlan.id,
      targetPlanCode: targetPlan.code,
      requestedPlanInput: rawPlanInput,
      normalizedPlanCode: planCode,
      requestedCurrency,
      nodeEnv: process.env.NODE_ENV,
      stripeMode: process.env.STRIPE_MODE,
      hasDbStripePriceId: Boolean(targetPlan.stripe_price_id),
      hasPlanOptionConfig: Boolean(planCfg),
      hasPlanOptionCurrencyPrice,
    });

    return res.status(400).json({
      success: false,
      message: "Target plan is not linked to Stripe for this currency.",
      code: "ctrl_changePlan_err20",
      requestId: (req as any).requestId,
    });
  }
  const targetStripePriceId = resolved.priceId;

  // Prevent overlapping pending changes
  if (subscription.pending_plan_id) {
    logger.warn("subscription.change_plan::pending_change_conflict", {
      code: "ctrl_changePlan_err21",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: user.id,
      subscriptionId: subscription.id,
    });
    return res.status(409).json({
      success: false,
      code: "ctrl_changePlan_err21",
      requestId: (req as any).requestId,
      message: locale === "fr" ? "Un changement d’abonnement est déjà en cours." : "A plan change is already pending.",
    });
  }

  const billingLock = await getStripeBillingLock({
    stripe,
    stripeSubscriptionId: subscription.stripe_subscription_id,
  });
  if (billingLock.locked) {
    logger.warn("subscription.change_plan::billing_locked", {
      code: "ctrl_changePlan_err22",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: user.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    });
    return res.status(409).json({
      success: false,
      message: formatBillingLockMessage({ locale, lock: billingLock }),
      code: "ctrl_changePlan_err22",
      requestId: (req as any).requestId,
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
      code: "ctrl_changePlan_err23",
      userId: user.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    });
    return res.status(502).json({
      success: false,
      message: "Unable to read Stripe subscription items.",
      code: "ctrl_changePlan_err23",
      requestId: (req as any).requestId,
    });
  }

  const currentPeriodEnd = new Date(currentPeriodEndUnix * 1000);

  if (changeType === "upgrade") {
    // Immediate upgrade with proration. Do NOT mark plan active in DB until webhook confirms.
    try {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        items: [{ id: subscriptionItemId, price: targetStripePriceId }],
        // Start a fresh billing period from the successful upgrade time.
        billing_cycle_anchor: "now",
        // Force immediate invoice + payment attempt for the proration delta.
        proration_behavior: "always_invoice",
        // Hard-fail if payment cannot be completed immediately (prevents pending payments).
        payment_behavior: "error_if_incomplete",
        expand: ["latest_invoice.payment_intent", "items.data.price"],
      } as any);

      // Persist pending upgrade; webhook will flip plan_id when Stripe is in sync.
      await updateSubscription(subscription.id, {
        pending_plan_id: targetPlan.id,
        pending_change_type: "upgrade",
        pending_change_effective_at: null,
        stripe_schedule_id: null,
      });

      return res.status(200).json({
        success: true,
        change_type: "upgrade",
        pending: true,
        message:
          locale === "fr"
            ? "Upgrade demandé. Le nouveau plan sera activé après confirmation de paiement."
            : "Upgrade requested. The new plan will be activated after payment confirmation.",
      });
    } catch (err: any) {
      logger.error("subscription.change_plan::stripe_upgrade_failed", {
        code: "ctrl_changePlan_err24",
        userId: user.id,
        message: err?.message || String(err),
      });

      const statusCode = Number(err?.statusCode ?? 0);
      if (statusCode === 402) {
        logger.warn("subscription.change_plan::payment_required_for_upgrade", {
          code: "ctrl_changePlan_err25",
          requestId: (req as any).requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          userId: user.id,
          stripeSubscriptionId: subscription.stripe_subscription_id,
        });
        return res.status(402).json({
          success: false,
          code: "ctrl_changePlan_err25",
          requestId: (req as any).requestId,
          message:
            locale === "fr"
              ? "Paiement refusÃ© ou non validable immÃ©diatement. Lâ€™upgrade nâ€™a pas Ã©tÃ© appliquÃ©."
              : "Payment failed or cannot be completed immediately. Upgrade was not applied.",
        });
      }

      return res.status(502).json({
        success: false,
        code: "ctrl_changePlan_err26",
        requestId: (req as any).requestId,
        message:
          locale === "fr" ? "Ã‰chec Stripe lors de lâ€™upgrade." : "Stripe upgrade failed.",
      });
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
      logger.error("subscription.change_plan::current_stripe_price_missing", {
        code: "ctrl_changePlan_err27",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
      });
      return res.status(502).json({
        success: false,
        message: "Unable to read current Stripe price.",
        code: "ctrl_changePlan_err27",
        requestId: (req as any).requestId,
      });
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

    // Validation: ensure Stripe confirms the schedule exists and is in an expected state.
    try {
      const refreshed: any = await (stripe as any).subscriptionSchedules.retrieve(schedule.id);
      const st = String(refreshed?.status || "");
      if (!["active", "not_started"].includes(st)) {
        logger.warn("subscription.change_plan::stripe_schedule_not_confirmed", {
          code: "ctrl_changePlan_err28",
          requestId: (req as any).requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          userId: user.id,
          stripeSubscriptionId: subscription.stripe_subscription_id,
          scheduleId: schedule.id,
          status: st,
        });
        return res.status(502).json({
          success: false,
          code: "ctrl_changePlan_err28",
          requestId: (req as any).requestId,
          message:
            locale === "fr"
              ? "Stripe nâ€™a pas confirmÃ© la programmation du downgrade. RÃ©essayez."
              : "Stripe did not confirm the scheduled downgrade. Please retry.",
        });
      }
    } catch {
      logger.warn("subscription.change_plan::stripe_schedule_validation_failed", {
        code: "ctrl_changePlan_err29",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        scheduleId: schedule.id,
      });
      return res.status(502).json({
        success: false,
        code: "ctrl_changePlan_err29",
        requestId: (req as any).requestId,
        message:
          locale === "fr"
            ? "Impossible de valider lâ€™Ã©tat Stripe aprÃ¨s programmation."
            : "Unable to validate Stripe state after scheduling.",
      });
    }

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
      code: "ctrl_changePlan_err30",
      userId: user.id,
      message: err?.message || String(err),
    });
    return res.status(502).json({
      success: false,
      message: "Stripe schedule update failed.",
      code: "ctrl_changePlan_err30",
      requestId: (req as any).requestId,
    });
  }
};
