import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import {
  getUserByEmail,
  updateUserMarketingConsent,
} from "../../DB/queriesSQL/queriesSQL.js";
import { renderMjmlTemplate } from "../../MJML/functions/renderMjmlTemplate.js";
import { buildLogoUrl } from "../../utils/publicAssetUrl.js";
import {
  createSmtpTransporter,
  resolveMailAppName,
  resolveMailSender,
} from "../../utils/mailer.js";
import { resolveRequestLocale } from "../../utils/locale.js";

async function sendMarketingConsentConfirmationEmail(params: {
  req: any;
  userEmail: string;
  marketingConsent: boolean;
  locale: "fr" | "en" | "de" | "it";
}) {
  const isProd = process.env.NODE_ENV === "production";
  const transporter = createSmtpTransporter(isProd);
  if (!transporter) return;

  const appName = resolveMailAppName();
  const sender = resolveMailSender(isProd);
  const logoUrl = buildLogoUrl({ req: params.req, isProd });

  const marketingStatusLabelByLocale: Record<
    "fr" | "en" | "de" | "it",
    { enabled: string; disabled: string }
  > = {
    fr: { enabled: "Offres activées", disabled: "Offres désactivées" },
    en: { enabled: "Offers enabled", disabled: "Offers disabled" },
    de: { enabled: "Angebote aktiviert", disabled: "Angebote deaktiviert" },
    it: { enabled: "Offerte attivate", disabled: "Offerte disattivate" },
  };
  const marketingStatusLabel =
    marketingStatusLabelByLocale[params.locale]?.[params.marketingConsent ? "enabled" : "disabled"] ??
    marketingStatusLabelByLocale.en[params.marketingConsent ? "enabled" : "disabled"];

  const subjectByLocale: Record<"fr" | "en" | "de" | "it", string> = {
    fr: "Préférence marketing mise à jour",
    en: "Marketing preference updated",
    de: "Marketing-Einstellung aktualisiert",
    it: "Preferenza marketing aggiornata",
  };
  const subject = subjectByLocale[params.locale] || subjectByLocale.en;

  const { html: mjmlHtml } = await renderMjmlTemplate(
    `marketing.consent.updated.${params.locale}.mjml`,
    { appName, logoUrl, marketingStatusLabel },
    params.locale
  );

  const html = mjmlHtml && mjmlHtml.trim().length > 0 ? mjmlHtml : undefined;
  await transporter.sendMail({
    from: `"${appName}" <${sender}>`,
    to: params.userEmail,
    subject,
    html,
  });
}

export const updateMarketingConsentController: RequestHandler = async (req, res) => {
  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    return res.status(401).json({ success: false, message: "Unauthenticated." });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const raw = (req as any).body?.marketing_consent;
  if (typeof raw !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "Body must be: { marketing_consent: true|false }",
    });
  }

  const previous = user.marketing_consent === 1;
  await updateUserMarketingConsent(user.id, raw, new Date());
  logger.info("marketing.consent::updated", { userId: user.id, marketingConsent: raw });

  if (previous !== raw) {
    const locale = resolveRequestLocale(req);
    sendMarketingConsentConfirmationEmail({
      req,
      userEmail: user.email,
      marketingConsent: raw,
      locale,
    }).catch((err: any) => {
      logger.warn("marketing.consent::email_failed", {
        userId: user.id,
        message: err?.message || String(err),
      });
    });
  }
  return res.status(200).json({
    success: true,
    marketing_consent: raw,
    marketing_consent_updated_at: new Date().toISOString(),
  });
};
