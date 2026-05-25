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
    logger.warn("marketingConsent::unauthenticated", {
      code: "ctrl_marketingConsent_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(401).json({
      success: false,
      message: "Unauthenticated.",
      code: "ctrl_marketingConsent_err1",
    });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    logger.warn("marketingConsent::user_not_found", {
      code: "ctrl_marketingConsent_err2",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(404).json({
      success: false,
      message: "User not found.",
      code: "ctrl_marketingConsent_err2",
    });
  }

  const raw = (req as any).body?.marketing_consent;
  if (typeof raw !== "boolean") {
    logger.warn("marketingConsent::invalid_body", {
      code: "ctrl_marketingConsent_err3",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      userId: user.id,
    });
    return res.status(400).json({
      success: false,
      message: "Body must be: { marketing_consent: true|false }",
      code: "ctrl_marketingConsent_err3",
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
        code: "ctrl_marketingConsent_err4",
        requestId: (req as any).requestId,
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
