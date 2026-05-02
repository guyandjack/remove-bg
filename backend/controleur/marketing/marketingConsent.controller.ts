import type { RequestHandler } from "express";
import { logger } from "../../logger.ts";
import {
  getUserByEmail,
  updateUserMarketingConsent,
} from "../../DB/queriesSQL/queriesSQL.ts";
import { renderMjmlTemplate } from "../../MJML/functions/renderMjmlTemplate.ts";
import { buildLogoUrl } from "../../utils/publicAssetUrl.ts";
import {
  createSmtpTransporter,
  resolveMailAppName,
  resolveMailSender,
} from "../../utils/mailer.ts";

function resolveLocale(input: unknown): "fr" | "en" | "de" | "it" {
  const raw = String(input || "en").toLowerCase();
  return (["fr", "en", "de", "it"].includes(raw) ? raw : "en") as any;
}

async function sendMarketingConsentConfirmationEmail(params: {
  req: any;
  userEmail: string;
  marketingConsent: boolean;
  locale: "fr" | "en" | "de" | "it";
}) {
  const isProd = process.env.NODE_ENV === "production";
  const transporter = createSmtpTransporter(isProd);
  if (!transporter) return;

  // Templates exist for fr/en; fallback to en for other locales
  const templateLocale = (params.locale === "fr" || params.locale === "en") ? params.locale : "en";
  const appName = resolveMailAppName();
  const sender = resolveMailSender(isProd);
  const logoUrl = buildLogoUrl({ req: params.req, isProd });

  const marketingStatusLabel =
    templateLocale === "fr"
      ? params.marketingConsent
        ? "Offres activées"
        : "Offres désactivées"
      : params.marketingConsent
      ? "Offers enabled"
      : "Offers disabled";

  const subject =
    templateLocale === "fr"
      ? "Préférence marketing mise à jour"
      : "Marketing preference updated";

  const { html: mjmlHtml } = await renderMjmlTemplate(
    `marketing.consent.updated.${templateLocale}.mjml`,
    { appName, logoUrl, marketingStatusLabel },
    templateLocale
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
    const langHeader = req.headers["accept-language"];
    const locale = resolveLocale(Array.isArray(langHeader) ? langHeader[0] : langHeader);
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
