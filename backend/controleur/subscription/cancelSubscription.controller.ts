import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import { getStripeClient } from "../../function/stripe/stripeClient.js";
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

function resolveLocale(input: unknown): "fr" | "en" | "de" | "it" {
  const raw = String(input || "en").toLowerCase();
  return (["fr", "en", "de", "it"].includes(raw) ? raw : "en") as any;
}

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
      logger.warn("subscription.cancel::smtp_not_configured", { userId: params.userId });
      return;
    }

    const appName = resolveMailAppName();
    const sender = resolveMailSender(isProd);
    const logoUrl = buildLogoUrl({ req: params.req, isProd });

    const dashboardUrl = `${buildPublicBaseUrl(isProd)}/dashboard`;

    const planAccessUntil = formatIsoDate(params.currentPeriodEnd);
    const subject =
      params.locale === "fr"
        ? isProd
          ? "Confirmation d’annulation d’abonnement"
          : "[DEV] Confirmation d’annulation d’abonnement"
        : isProd
        ? "Subscription cancellation confirmation"
        : "[DEV] Subscription cancellation confirmation";

    const templateLocale =
      params.locale === "fr" || params.locale === "en" ? params.locale : "en";

    const { html: mjmlHtml } = await renderMjmlTemplate(
      `subscription.canceling.${templateLocale}.mjml`,
      {
        appName,
        logoUrl,
        planAccessUntil,
        creditsRemaining: params.creditsRemaining ?? "—",
        dashboardUrl,
      },
      templateLocale
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
      userId: params.userId,
      message: mailErr?.message || String(mailErr),
    });
  }
}

export const cancelSubscriptionController: RequestHandler = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const stripe = getStripeClient();
  const langHeader = req.headers["accept-language"];
  const locale = resolveLocale(Array.isArray(langHeader) ? langHeader[0] : langHeader);

  if (!stripe) {
    return res.status(500).json({
      success: false,
      message: "Stripe is not configured on this server.",
    });
  }

  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    return res.status(401).json({
      success: false,
      message: "Unauthenticated.",
    });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found.",
    });
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return res.status(400).json({
      success: false,
      message: "No active subscription found.",
    });
  }

  if (!subscription.stripe_subscription_id) {
    return res.status(400).json({
      success: false,
      message: "No active Stripe subscription found for this account.",
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
    updatedStripeSub = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true }
    );
  } catch (err: any) {
    logger.error("subscription.cancel::stripe_update_failed", {
      userId: user.id,
      subscriptionId: subscription.id,
      message: err?.message || String(err),
    });
    return res.status(502).json({
      success: false,
      message: "Stripe update failed.",
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
