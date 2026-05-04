import type { RequestHandler } from "express";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { getUserByEmail } from "../DB/queriesSQL/queriesSQL.js";
import { logger } from "../logger.js";
import { renderMjmlTemplate } from "../MJML/functions/renderMjmlTemplate.js";
import { signPasswordResetToken } from "../function/createToken.js";
import { buildLogoUrl } from "../utils/publicAssetUrl.js";

function normalizeEmail(email: unknown): string | null {
  if (!email) return null;
  const str = String(email).trim().toLowerCase();
  return str.length ? str : null;
}

function resolveLocale(lang: unknown): string {
  const l = String(lang || "en").toLowerCase();
  return ["fr", "de", "en", "it"].includes(l) ? l : "en";
}

function parseExpiryMinutes(raw: string | undefined): number {
  const v = String(raw || "15m").trim();
  if (v.endsWith("m")) return Number(v.slice(0, -1)) || 15;
  if (v.endsWith("h")) return (Number(v.slice(0, -1)) || 1) * 60;
  return 15;
}

/**
 * Contrôleur Forgot Password
 * - Répond toujours 200 (évite l’énumération)
 * - Si l'utilisateur existe: envoie un email avec lien /reset-password?token=...
 */
export const forgotPassword: RequestHandler = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  try {
    const { email, lang } = (req as any).userValidated as { email: string; lang: string };
    if (!email || !lang) {
      return res.status(400).json({ status: "error", message: "missing payload code_forgot_1" });
    }

    const normalizedEmail = normalizeEmail(email);
    const locale = resolveLocale(lang);
    if (!normalizedEmail || !locale) {
      return res.status(400).json({ status: "error", message: "normalise payload code_forgot_2" });
    }

    const user = await getUserByEmail(normalizedEmail);
    if (user) {
      const jti = randomUUID();
      const token = signPasswordResetToken({
        sub: user.id,
        email: user.email,
        typ: "password_reset",
        jti,
      });

      const baseUrl = isProd
        ? process.env.DOMAIN_URL_PROD || "https://wizpix.ch"
        : process.env.DOMAIN_URL_DEV || "http://localhost:5173";
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

      const logoUrl = buildLogoUrl({ req, isProd });

      const from = (
        isProd
          ? process.env.MAILBOX_PROD_ADDRESS || process.env.MAILBOX_PROD_ADRESS
          : process.env.MAILBOX_DEV_ADDRESS || process.env.MAILBOX_DEV_ADRESS
      ) as string | undefined;
      const pass = (isProd ? process.env.MAILBOX_PROD_PASSWORD : process.env.MAILBOX_DEV_PASSWORD) as
        | string
        | undefined;

      if (!from || !pass) {
        logger.warn("SMTP credentials missing for forgot password", { userId: user.id });
        return res.status(200).json({ status: "success", message: "If an account exists, a reset email has been sent." });
      }

      const transporter = nodemailer.createTransport({
        host: isProd ? process.env.MAILBOX_PROD_HOST : "smtp.gmail.com",
        port: isProd ? Number(process.env.MAILBOX_PROD_PORT || 465) : 465,
        secure: true,
        auth: { user: from, pass },
        tls: { rejectUnauthorized: false },
      });

      const sender =
        (isProd
          ? process.env.MAILBOX_PROD_ADDRESS || process.env.MAILBOX_PROD_ADRESS
          : process.env.MAILBOX_DEV_ADDRESS || process.env.MAILBOX_DEV_ADRESS) ?? "";

      const appName = process.env.MAIL_SENDER_NAME || "Wizard Pixel";
      const subject = isProd ? "Réinitialisation de votre mot de passe" : "[DEV] Réinitialisation de votre mot de passe";

      const expiryMinutes = parseExpiryMinutes(process.env.JWT_PASSWORD_RESET_EXPIRES_IN);
      const { html: mjmlHtml } = await renderMjmlTemplate(
        `forgot.password.${locale}.mjml`,
        { email, resetUrl, appName, logoUrl, expiryMinutes },
        locale
      );

      const html = mjmlHtml && mjmlHtml.trim().length > 0 ? mjmlHtml : undefined;
      await transporter.sendMail({ from: `"${appName}" <${sender}>`, to: email, subject, html });
      logger.info("Password reset email sent", { userId: user.id });
    } else {
      logger.info("Password reset requested for non-existing email", { email: "[redacted]" });
    }

    return res.status(200).json({ status: "success", message: "If an account exists, a reset email has been sent." });
  } catch (err: any) {
    logger.error("Forgot password error", { message: err?.message || String(err) });
    return res.status(200).json({ status: "success", message: "If an account exists, a reset email has been sent." });
  }
};

export default forgotPassword;

