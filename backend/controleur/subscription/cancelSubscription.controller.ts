import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import { getStripeClient } from "../../function/stripe/stripeClient.js";
import {
  formatBillingLockMessage,
  getStripeBillingLock,
} from "../../function/stripe/stripeBillingGuards.js";
import {
  getActiveSubscription,
  getActiveUsageBillingPeriod,
  getUserByEmail,
  updateSubscription,
} from "../../DB/queriesSQL/queriesSQL.js";
import { renderMjmlTemplate } from "../../MJML/functions/renderMjmlTemplate.js";
import { buildLogoUrl } from "../../utils/publicAssetUrl.js";
import { 
  resolveMailAppName, 
  resolveMailSender, 
  createSmtpTransporter, 
} from "../../utils/mailer.js"; 
import { resolveRequestLocale } from "../../utils/locale.js";

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildPublicBaseUrl(isProd: boolean): string {
  const fallback = "http://localhost:5173";
  const base = isProd
    ? process.env.DOMAIN_URL_PROD || fallback
    : process.env.DOMAIN_URL_DEV || fallback;
  return String(base || fallback).replace(/\/+$/, "");
}

function buildApiBaseUrl(req: any, isProd: boolean): string {
  // Prefer explicit public API base if configured (useful behind proxies or when API != current host)
  const explicit = process.env.API_PUBLIC_BASE_URL;
  if (explicit && explicit.trim().length > 0) return explicit.replace(/\/+$/, "");

  // Backward-compatible env naming used in this project
  const baseUrl = isProd
    ? process.env.BASE_URL_PROD
    : process.env.BASE_URL_DEV;
  if (baseUrl && baseUrl.trim().length > 0) return baseUrl.replace(/\/+$/, "");

  // Fallback: derive from the current request host (usually the backend origin).
  // This avoids accidentally generating API links on the frontend domain.
  try {
    const proto =
      (req?.headers?.["x-forwarded-proto"] as string | undefined) ||
      (req?.protocol as string | undefined) ||
      "http";
    const host =
      (req?.headers?.["x-forwarded-host"] as string | undefined) ||
      (typeof req?.get === "function" ? (req.get("host") as string | undefined) : undefined) ||
      (req?.headers?.host as string | undefined);
    if (host && String(host).trim().length > 0) {
      return `${String(proto).split(",")[0].trim()}://${String(host).trim()}`.replace(/\/+$/, "");
    }
  } catch {}

  // Last resort: frontend base (not ideal, but keeps links non-broken).
  return buildPublicBaseUrl(isProd);
}

async function sendCancellationConfirmationEmail(params: {
  req: any;
  userId: string;
  userEmail: string;
  locale: "fr" | "en" | "de" | "it";
  currentPeriodEnd: Date;
  creditsRemaining: number | null;
}) {
  const isProd = process.env.NODE_ENV === "production";
  try {
    const transporter = createSmtpTransporter(isProd);
    if (!transporter) {
      logger.warn("subscription.cancel::smtp_not_configured", {
        code: "ctrl_cancelSubscription_err1",
        userId: params.userId,
      });
      return;
    }

    const appName = resolveMailAppName();
    const sender = resolveMailSender(isProd);
    const logoUrl = buildLogoUrl({ req: params.req, isProd });

    const dashboardUrl = `${buildPublicBaseUrl(isProd)}/dashboard`;

    const planAccessUntil = formatIsoDate(params.currentPeriodEnd);
    const baseSubjectByLocale: Record<
      "fr" | "en" | "de" | "it",
      string
    > = {
      fr: "Confirmation d’annulation d’abonnement",
      en: "Subscription cancellation confirmation",
      de: "Bestätigung der Abonnementkündigung",
      it: "Conferma di annullamento dell’abbonamento",
    };
    const baseSubject = baseSubjectByLocale[params.locale] || baseSubjectByLocale.en;
    const subject = isProd ? baseSubject : `[DEV] ${baseSubject}`;

    const { html: mjmlHtml } = await renderMjmlTemplate(
      `subscription.canceling.${params.locale}.mjml`,
      {
        appName,
        logoUrl,
        planAccessUntil,
        creditsRemaining: params.creditsRemaining ?? "—",
        dashboardUrl,
      },
      params.locale
    );

    const html = mjmlHtml && mjmlHtml.trim().length > 0 ? mjmlHtml : undefined;
    await transporter.sendMail({
      from: `"${appName}" <${sender}>`,
      to: params.userEmail,
      subject,
      html,
    });
  } catch (mailErr: any) {
    logger.warn("subscription.cancel::email_failed", {
      code: "ctrl_cancelSubscription_err2",
      userId: params.userId,
      message: mailErr?.message || String(mailErr),
    });
  }
}

export const cancelSubscriptionController: RequestHandler = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const stripe = getStripeClient();
  const locale = resolveRequestLocale(req);

  if (!stripe) {
    logger.error("subscription.cancel::stripe_not_configured", {
      code: "ctrl_cancelSubscription_err3",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(500).json({
      success: false,
      message: "Stripe is not configured on this server.",
      code: "ctrl_cancelSubscription_err3",
      requestId: (req as any).requestId,
    });
  }

  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    logger.warn("subscription.cancel::unauthenticated_missing_payload", {
      code: "ctrl_cancelSubscription_err4",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(401).json({
      success: false,
      message: "Unauthenticated.",
      code: "ctrl_cancelSubscription_err4",
      requestId: (req as any).requestId,
    });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    logger.warn("subscription.cancel::user_not_found", {
      code: "ctrl_cancelSubscription_err5",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      email: String(email),
    });
    return res.status(404).json({
      success: false,
      message: "User not found.",
      code: "ctrl_cancelSubscription_err5",
      requestId: (req as any).requestId,
    });
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    logger.warn("subscription.cancel::no_active_subscription", {
      code: "ctrl_cancelSubscription_err6",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: user.id,
    });
    return res.status(400).json({
      success: false,
      message: "No active subscription found.",
      code: "ctrl_cancelSubscription_err6",
      requestId: (req as any).requestId,
    });
  }

  if (!subscription.stripe_subscription_id) {
    logger.warn("subscription.cancel::no_active_stripe_subscription", {
      code: "ctrl_cancelSubscription_err7",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: user.id,
      subscriptionId: subscription.id,
    });
    return res.status(400).json({
      success: false,
      message: "No active Stripe subscription found for this account.",
      code: "ctrl_cancelSubscription_err7",
      requestId: (req as any).requestId,
    });
  }

  if (
    subscription.status === "canceling" &&
    subscription.stripe_cancel_at_period_end === 1 &&
    (subscription.plan_access_until || subscription.current_period_end || subscription.period_end)
  ) {
    const accessUntil =
      subscription.plan_access_until ??
      subscription.current_period_end ??
      subscription.period_end;
    const accessUntilDate = new Date(accessUntil);

    // Re-send confirmation email (best-effort). This is useful when the user clicks again
    // and expects an updated reminder. Consider adding throttling if abuse becomes an issue.
    try {
      const usage = await getActiveUsageBillingPeriod(user.id, new Date());
      const creditsRemaining = usage?.remaining_in_period ?? null;
      await sendCancellationConfirmationEmail({
        req,
        userId: user.id,
        userEmail: user.email,
        locale,
        currentPeriodEnd: accessUntilDate,
        creditsRemaining,
      });
    } catch {}

    return res.status(200).json({
      success: true,
      subscription_status: "canceling",
      plan_access_until: formatIsoDate(accessUntilDate),
      message:
        locale === "fr"
          ? `Votre abonnement est déjà en cours d’annulation. Vous conservez l’accès jusqu’au ${formatIsoDate(
              accessUntilDate
            )}.`
          : `Your cancellation is already scheduled. You keep access until ${formatIsoDate(
              accessUntilDate
            )}.`,
    });
  }

  let updatedStripeSub;
  try {
    const lock = await getStripeBillingLock({
      stripe,
      stripeSubscriptionId: subscription.stripe_subscription_id,
    });
    if (lock.locked) {
      logger.warn("subscription.cancel::billing_locked", {
        code: "ctrl_cancelSubscription_err8",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        subscriptionId: subscription.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
      });
      return res.status(409).json({
        success: false,
        message: formatBillingLockMessage({ locale, lock }),
        code: "ctrl_cancelSubscription_err8",
        requestId: (req as any).requestId,
      });
    }

    updatedStripeSub = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true }
    );
  } catch (err: any) {
    logger.error("subscription.cancel::stripe_update_failed", {
      code: "ctrl_cancelSubscription_err9",
      userId: user.id,
      subscriptionId: subscription.id,
      message: err?.message || String(err),
    });
    return res.status(502).json({
      success: false,
      message: "Stripe update failed.",
      code: "ctrl_cancelSubscription_err9",
      requestId: (req as any).requestId,
    });
  }

  // Stripe can sometimes return partial objects depending on API version / permissions.
  // To make this endpoint robust, re-fetch the subscription after update and trust only that payload.
  let refreshedStripeSub: any = null;
  try {
    refreshedStripeSub = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );
  } catch (err: any) {
    logger.error("subscription.cancel::stripe_retrieve_failed", {
      code: "ctrl_cancelSubscription_err10",
      userId: user.id,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      message: err?.message || String(err),
    });
  }

  const stripeSub = refreshedStripeSub || updatedStripeSub;

  const currentPeriodEndUnix = (stripeSub as any)?.current_period_end;
  const cancelAtPeriodEnd = Boolean((stripeSub as any)?.cancel_at_period_end);
  const currentPeriodEnd =
    typeof currentPeriodEndUnix === "number"
      ? new Date(currentPeriodEndUnix * 1000)
      : null;

  if (!cancelAtPeriodEnd || !currentPeriodEnd) {
    logger.error("subscription.cancel::stripe_response_invalid", {
      code: "ctrl_cancelSubscription_err11",
      userId: user.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      stripeObjectType: String((stripeSub as any)?.object || ""),
      cancelAtPeriodEndRaw: (stripeSub as any)?.cancel_at_period_end,
      cancelAtPeriodEnd,
      currentPeriodEndUnix,
    });
    return res.status(502).json({
      success: false,
      message: "Stripe response is missing cancel_at_period_end/current_period_end.",
      code: "ctrl_cancelSubscription_err11",
      requestId: (req as any).requestId,
    });
  }

  const now = new Date();
  await updateSubscription(subscription.id, {
    status: "canceling",
    stripe_cancel_at_period_end: 1,
    current_period_end: currentPeriodEnd,
    plan_access_until: currentPeriodEnd,
    period_end: currentPeriodEnd,
    cancel_at: currentPeriodEnd,
  });

  const refreshedUsage = await getActiveUsageBillingPeriod(user.id, now);
  const creditsRemaining = refreshedUsage?.remaining_in_period ?? null;

  // Transactional email (best-effort, does not block API success)
  await sendCancellationConfirmationEmail({
    req,
    userId: user.id,
    userEmail: user.email,
    locale,
    currentPeriodEnd,
    creditsRemaining,
  });

  return res.status(200).json({
    success: true,
    subscription_status: "canceling",
    plan_access_until: formatIsoDate(currentPeriodEnd),
    plan_access_until_iso: currentPeriodEnd.toISOString(),
    message:
      locale === "fr"
        ? `Votre abonnement est annulé. Vous conservez l’accès jusqu’au ${formatIsoDate(
            currentPeriodEnd
          )}.`
        : `Your subscription renewal is canceled. You keep access until ${formatIsoDate(
            currentPeriodEnd
          )}.`,
  });
};
