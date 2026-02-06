import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import nodemailer, { TransportOptions } from "nodemailer";
import { randomUUID } from "node:crypto";
import { getUserByEmail } from "../DB/queriesSQL/queriesSQL.ts";
import { logger } from "../logger.ts";
import { renderMjmlTemplate } from "../MJML/functions/renderMjmlTemplate.ts";
import {
  signAccessToken,
  signRefreshToken,
  setCookieOptionsObject,
} from "../function/createToken.ts";
import { buildLogoUrl } from "../utils/publicAssetUrl.ts";




function env(name: string, opts?: { required?: boolean; fallback?: string }) {
  const val = process.env[name] ?? opts?.fallback;
  if (opts?.required && (val === undefined || val === "")) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val!;
}

function normalizeEmail(email: unknown): string | null {
  if (!email) return null;
  const str = String(email).trim().toLowerCase();
  return str.length ? str : null;
}

function resolveLocale(lang: unknown): string {
  const l = String(lang || "en").toLowerCase();
  return ["fr", "de", "en", "it"].includes(l) ? l : "en";
}

/**
 * Contrôleur Forgot Password
 * - Valide l'email via le middleware `checkForgotPassword`
 * - Si l'utilisateur existe: génère un JWT court et envoie un email avec un lien de réinitialisation
 * - Répond toujours 200 pour éviter l’énumération de comptes
 */
export const forgotPassword: RequestHandler = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  try {
    const { email, lang } = (req as any).userValidated as { email: string; lang: string };

    if (!email || !lang) {
      return res.status(400).json({
        "status": "error",
        "message":"missing payload code_forgot_1"
      })
    }
    const normalizedEmail = normalizeEmail(email);
    const locale = resolveLocale(lang);

    if (!normalizedEmail || !locale) {
      return res.status(400).json({
        status: "error",
        message: "normalise payload code_forgot_2",
      });
    }
    // Cherche l'utilisateur sans divulguer l'existence dans la réponse
    const user = await getUserByEmail(normalizedEmail);

    if (user) {
      // Génère un token de reset signé (RS256) valable 15 minutes
      //const privateKey = env("JWT_PRIVATE_KEY", { required: true });
      const jti = randomUUID();
      const token = signAccessToken({
        sub: user.id,
        email: user.email,
        typ: "password_reset",
        jti,
      });
      

      // Construit le lien de réinitialisation côté front
      const baseUrl = isProd
        ? process.env.DOMAIN_URL_PROD ||
          "https://wizpix.ch"
        : process.env.DOMAIN_URL_DEV ||
          "http://localhost:5173";
      const resetPath = "/reset-password";
      const resetUrl = `${baseUrl}${resetPath}?token=${encodeURIComponent(token)}`;

      const logoUrl = buildLogoUrl({ req, isProd });

      // Prépare l'envoi de l'email
      const name = String(user.email).split("@")[0];
      const from = (
        isProd
          ? process.env.MAILBOX_PROD_ADDRESS || process.env.MAILBOX_PROD_ADRESS
          : process.env.MAILBOX_DEV_ADDRESS || process.env.MAILBOX_DEV_ADRESS
      ) as string | undefined;
      const pass = (
        isProd
          ? process.env.MAILBOX_PROD_PASSWORD
          : process.env.MAILBOX_DEV_PASSWORD
      ) as string | undefined;

      if (!from || !pass) {
        console.warn("SMTP credentials missing; logging OTP in dev:", {
          email: normalizedEmail,
           
        });
        return res
          .status(200)
          .json({
            ok: true,
            email: normalizedEmail,
            message: "impossible to send mail fotgot_3",
            
          });
      }

      const transporter = nodemailer.createTransport({
        host: isProd ? process.env.MAILBOX_PROD_HOST : "smtp.gmail.com",
        port: isProd ? Number(process.env.MAILBOX_PROD_PORT || 465) : 465,
        secure: true,
        auth: { user: from, pass },
        tls: { rejectUnauthorized: false },
      });
      
      /* await transporter.verify().catch((e) => {
        logger.warn("SMTP verify failed for forgot password", { err: String(e) });
      }); */
    

      const sender = (isProd
        ? process.env.MAILBOX_PROD_ADDRESS || process.env.MAILBOX_PROD_ADRESS
        : process.env.MAILBOX_DEV_ADDRESS || process.env.MAILBOX_DEV_ADRESS) ?? "";

      const appName = process.env.MAIL_SENDER_NAME || "Wizard Pixel";

      const subject = isProd
        ? "Réinitialisation de votre mot de passe"
        : "[DEV] Réinitialisation de votre mot de passe";
      
      // Rendu MJML du template FR
      const { html: mjmlHtml } = await renderMjmlTemplate(
        "forgot.password.fr.mjml",
        { email, resetUrl, appName, logoUrl, expiryMinutes: 15 },
        lang
      );

      const html = mjmlHtml && mjmlHtml.trim().length > 0 ? mjmlHtml : undefined;

      await transporter.sendMail({ from: `"${appName}" <${sender}>`, to: email, subject, html });

      logger.info("Password reset email sent", { email, userId: user.id });
    } else {
      // Pas d'utilisateur correspondant: log uniquement pour audit
      logger.info("Password reset requested for non-existing email", { email });
    }

    // Toujours 200 pour éviter l'énumération
    return res.status(200).json({ status: "success", message: "If an account exists, a reset email has been sent." });
  } catch (err: any) {
    logger.error("Forgot password error", { message: err?.message || String(err) });
    // Réponse générique
    return res.status(200).json({ status: "success", message: "If an account exists, a reset email has been sent." });
  }
};

export default forgotPassword;
