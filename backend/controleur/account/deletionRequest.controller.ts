import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import {
  anonymizeUserCredentials,
  createAccountDeletionFeedbackRequest,
  getActiveSubscription,
  getUserByEmail,
  requestAccountDeletion,
  revokeAllRefreshTokensForUser,
  updateUserMarketingConsent,
  updateSubscription,
} from "../../DB/queriesSQL/queriesSQL.js";
import { getStripeClient } from "../../function/stripe/stripeClient.js";
import {
  formatBillingLockMessage,
  getStripeBillingLock,
} from "../../function/stripe/stripeBillingGuards.js";
import { renderMjmlTemplate } from "../../MJML/functions/renderMjmlTemplate.js";
import { buildLogoUrl } from "../../utils/publicAssetUrl.js";
import {
  createSmtpTransporter,
  resolveMailAppName,
  resolveMailSender,
} from "../../utils/mailer.js";
import crypto from "node:crypto";

function resolveLocale(input: unknown): "fr" | "en" | "de" | "it" {
  const raw = String(input || "en").toLowerCase();
  return (["fr", "en", "de", "it"].includes(raw) ? raw : "en") as any;
}

export const accountDeletionRequestController: RequestHandler = async (req, res) => {
  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    return res.status(401).json({ success: false, message: "Unauthenticated." });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const langHeader = req.headers["accept-language"];
  const locale = resolveLocale(Array.isArray(langHeader) ? langHeader[0] : langHeader);

  const now = new Date();
  const stripe = getStripeClient();

  // If the user has a paid Stripe subscription, deletion is only allowed if:
  // - Stripe is configured
  // - No billing is currently "in-flight" (open/draft invoice, pending payment intent, etc.)
  // - We can confirm Stripe accepted the cancellation (validation step) before anonymization/revocation.
  const activeSub = await getActiveSubscription(user.id);
  if (activeSub?.stripe_subscription_id) {
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message:
          locale === "fr"
            ? "Suppression impossible: Stripe nâ€™est pas configurÃ© sur ce serveur."
            : "Deletion not allowed: Stripe is not configured on this server.",
      });
    }

    const lock = await getStripeBillingLock({
      stripe,
      stripeSubscriptionId: activeSub.stripe_subscription_id,
    });
    if (lock.locked) {
      return res.status(409).json({
        success: false,
        message: formatBillingLockMessage({ locale, lock }),
      });
    }

    try {
      const stripeAny: any = stripe as any;

      // If a downgrade schedule exists, cancel it first to prevent future phases from reapplying changes.
      if (activeSub.stripe_schedule_id && stripeAny.subscriptionSchedules?.cancel) {
        await stripeAny.subscriptionSchedules.cancel(activeSub.stripe_schedule_id, {
          invoice_now: false,
          prorate: false,
        } as any);
      }

      if (stripeAny.subscriptions?.cancel) {
        await stripeAny.subscriptions.cancel(activeSub.stripe_subscription_id, {
          invoice_now: false,
          prorate: false,
        } as any);
      } else if (stripeAny.subscriptions?.del) {
        await stripeAny.subscriptions.del(activeSub.stripe_subscription_id);
      } else if (stripeAny.subscriptions?.delete) {
        await stripeAny.subscriptions.delete(activeSub.stripe_subscription_id);
      }

      // Validation: ensure Stripe reports the subscription as canceled.
      const canceled: any = await stripe.subscriptions.retrieve(activeSub.stripe_subscription_id);
      if (String(canceled?.status || "") !== "canceled") {
        return res.status(502).json({
          success: false,
          message:
            locale === "fr"
              ? "Suppression impossible: Ã©tat Stripe non confirmÃ© (abonnement pas encore annulÃ©)."
              : "Deletion not allowed: Stripe cancellation not confirmed.",
        });
      }

      // Defensive: ensure any open/draft invoices won't auto-advance/auto-collect.
      try {
        const invoices: any = await stripe.invoices.list({
          subscription: activeSub.stripe_subscription_id,
          limit: 10,
        } as any);
        for (const inv of invoices?.data || []) {
          const status = String(inv?.status || "");
          if ((status === "open" || status === "draft") && inv?.auto_advance !== false) {
            try {
              await stripe.invoices.update(String(inv.id), { auto_advance: false } as any);
            } catch {}
          }
        }
      } catch {}
    } catch (err: any) {
      logger.warn("account.deletion_request::stripe_cancel_failed", {
        userId: user.id,
        message: err?.message || String(err),
      });
      return res.status(502).json({
        success: false,
        message:
          locale === "fr"
            ? "Suppression impossible: Ã©chec lors de lâ€™annulation Stripe."
            : "Deletion not allowed: Stripe cancellation failed.",
      });
    }
  }

  const deletionFeedbackToken = crypto.randomBytes(32).toString("hex");
  const deletionFeedbackTokenHash = crypto
    .createHash("sha256")
    .update(deletionFeedbackToken)
    .digest("hex");
  const deletionFeedbackExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  let feedbackTokenStored = false;

  // 1) Mark deletion requested + disable marketing
  await requestAccountDeletion(user.id, now);
  await updateUserMarketingConsent(user.id, false, now);

  // Create a one-time feedback token (does not require auth to submit feedback).
  try {
    const created = await createAccountDeletionFeedbackRequest({
      userId: user.id,
      tokenHash: deletionFeedbackTokenHash,
      requestedAt: now,
      expiresAt: deletionFeedbackExpiresAt,
    });
    feedbackTokenStored = Boolean(created);
  } catch (err: any) {
    logger.warn("account.deletion_request::feedback_token_failed", {
      userId: user.id,
      message: err?.message || String(err),
    });
    feedbackTokenStored = false;
  }

  // 2) Revoke access window locally (Stripe cancellation already validated above when applicable)
  if (activeSub) {
    await updateSubscription(activeSub.id, {
      status: "canceled",
      is_active: null,
      canceled_at: now,
      period_end: now,
      current_period_end: now,
      plan_access_until: now,
      stripe_cancel_at_period_end: 0,
      pending_plan_id: null,
      pending_change_type: null,
      pending_change_effective_at: null,
      stripe_schedule_id: null,
    });
  }

  // 3) Revoke refresh tokens to prevent new sessions
  try {
    await revokeAllRefreshTokensForUser(user.id);
  } catch (err: any) {
    logger.warn("account.deletion_request::revoke_tokens_failed", {
      userId: user.id,
      message: err?.message || String(err),
    });
  }

  // 4) Send confirmation email (best-effort) BEFORE anonymizing email
  try {
    const transporter = createSmtpTransporter(process.env.NODE_ENV === "production");
    if (transporter) {
      const templateLocale = locale === "fr" || locale === "en" ? locale : "en";
      const appName = resolveMailAppName();
      const sender = resolveMailSender(process.env.NODE_ENV === "production");
      const logoUrl = buildLogoUrl({ req, isProd: process.env.NODE_ENV === "production" });

      const subject =
        templateLocale === "fr"
          ? "Confirmation de demande de suppression"
          : "Account deletion request confirmation";

      const { html: mjmlHtml } = await renderMjmlTemplate(
        `account.deletion.requested.${templateLocale}.mjml`,
        { appName, logoUrl },
        templateLocale
      );
      const html = mjmlHtml && mjmlHtml.trim().length > 0 ? mjmlHtml : undefined;
      await transporter.sendMail({
        from: `"${appName}" <${sender}>`,
        to: user.email,
        subject,
        html,
      });
    }
  } catch (err: any) {
    logger.warn("account.deletion_request::email_failed", {
      userId: user.id,
      message: err?.message || String(err),
    });
  }

  // 5) Anonymize credentials to block access immediately for existing access tokens (email lookup fails)
  try {
    const anonymizedEmail = `deleted+${user.id}@wizpix.invalid`;
    const randomPasswordHash = crypto.randomBytes(32).toString("hex");
    await anonymizeUserCredentials({
      userId: user.id,
      anonymizedEmail,
      passwordHash: randomPasswordHash,
    });
  } catch (err: any) {
    logger.warn("account.deletion_request::anonymize_failed", {
      userId: user.id,
      message: err?.message || String(err),
    });
  }

  return res.status(200).json({
    success: true,
    account_deletion_requested: true,
    deletion_feedback_token: feedbackTokenStored ? deletionFeedbackToken : null,
    message:
      "Votre demande de suppression a été enregistrée. L’accès au service est désactivé et votre demande sera traitée.",
  });
};
