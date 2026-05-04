import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import {
  anonymizeUserCredentials,
  getActiveSubscription,
  getUserByEmail,
  requestAccountDeletion,
  revokeAllRefreshTokensForUser,
  updateUserMarketingConsent,
  updateSubscription,
} from "../../DB/queriesSQL/queriesSQL.js";
import { getStripeClient } from "../../function/stripe/stripeClient.js";
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

  const now = new Date();
  const stripe = getStripeClient();

  // 1) Mark deletion requested immediately + disable marketing
  await requestAccountDeletion(user.id, now);
  await updateUserMarketingConsent(user.id, false, now);

  // 2) Cancel Stripe subscription immediately if present + revoke access window locally
  const activeSub = await getActiveSubscription(user.id);
  if (activeSub?.stripe_subscription_id && stripe) {
    try {
      // Stripe SDK naming varies across versions; try the common variants.
      const stripeAny: any = stripe as any;
      if (stripeAny.subscriptions?.cancel) {
        await stripeAny.subscriptions.cancel(activeSub.stripe_subscription_id);
      } else if (stripeAny.subscriptions?.del) {
        await stripeAny.subscriptions.del(activeSub.stripe_subscription_id);
      } else if (stripeAny.subscriptions?.delete) {
        await stripeAny.subscriptions.delete(activeSub.stripe_subscription_id);
      }
    } catch (err: any) {
      logger.warn("account.deletion_request::stripe_cancel_failed", {
        userId: user.id,
        message: err?.message || String(err),
      });
    }
  }

  if (activeSub) {
    await updateSubscription(activeSub.id, {
      status: "canceled",
      is_active: null,
      canceled_at: now,
      period_end: now,
      current_period_end: now,
      plan_access_until: now,
      stripe_cancel_at_period_end: 0,
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
      const langHeader = req.headers["accept-language"];
      const locale = resolveLocale(Array.isArray(langHeader) ? langHeader[0] : langHeader);
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
    message:
      "Votre demande de suppression a été enregistrée. L’accès au service est désactivé et votre demande sera traitée.",
  });
};
