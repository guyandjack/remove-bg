// signup email verification controller (robust, aligned with schema)
import type { RequestHandler } from "express";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2/promise";
import { connectDb } from "../DB/poolConnexion/poolConnexion.js";
import { renderMjmlTemplate } from "../MJML/functions/renderMjmlTemplate.js";
import { getUserByEmail } from "../DB/queriesSQL/queriesSQL.js";
import { resolveRequestLocale } from "../utils/locale.js";
import { logger } from "../logger.js";
/* import { planOption } from "../data/planOption.js";
import { buildLogoUrl } from "../utils/publicAssetUrl.js"; */

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtp(code: string, salt: Buffer): Buffer {
  return crypto.scryptSync(code, salt, 64);
}

function normalizeEmail(email: unknown): string | null {
  if (!email) return null;
  const str = String(email).trim().toLowerCase();
  return str.length ? str : null;
}

const sendMailVerification: RequestHandler = async (req, res) => {
  const httpRequestId = (req as any).requestId;
  const nodEnv = process.env.NODE_ENV || null;
  const baseUrlProd = process.env.BASE_URL_PROD || null;
  const baseUrlDev = process.env.BASE_URL_DEV || null;
  if (!baseUrlDev || !baseUrlProd || !nodEnv) {
    logger.error("sendMailVerification::missing_env", {
      code: "ctrl_signUpDataUser_err1",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(500).json({
      error: true,
      message: "Missing env values",
      code: "ctrl_signUpDataUser_err1",
      requestId: httpRequestId,
    });
  }
  const isProd = nodEnv === "production";
  const baseUrlUsed = isProd ? baseUrlProd : baseUrlDev;
  try {
    const { email, password, lang, plan, id, currency } = (req as any).userValidated || {};

    // Basic required fields
    if (!email || !lang || !password || !plan || !currency) {
      logger.warn("sendMailVerification::missing_required_fields", {
        code: "ctrl_signUpDataUser_err2",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(400).json({
        error: true,
        message: "Missing required fields (email, password, lang, plan, currency)",
        code: "ctrl_signUpDataUser_err2",
        requestId: httpRequestId,
      });
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      logger.warn("sendMailVerification::invalid_email", {
        code: "ctrl_signUpDataUser_err3",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(400).json({
        error: true,
        message: "Invalid email",
        code: "ctrl_signUpDataUser_err3",
        requestId: httpRequestId,
      });
    }

    const locale = resolveRequestLocale(req);
    const isResend = String(id || "").toLowerCase() === "resend";
    
    const planCode = String(plan).toLowerCase();
    const normalizedCurrency = String(currency).toUpperCase();
    const currencyCode: "CHF" | "EUR" | "USD" = ["CHF", "EUR", "USD"].includes(
      normalizedCurrency
    )
      ? (normalizedCurrency as "CHF" | "EUR" | "USD")
      : "CHF";
    // Validate plan against static config (no DB dependency)
    
   

    const otp = generateOtp();
    const salt = crypto.randomBytes(16);
    const codeHash = hashOtp(otp, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    const passwordHash = await bcrypt.hash(String(password), 12);
    const verificationId = crypto.randomUUID();

    const pool = await connectDb();
    const conn = await pool.getConnection();
    try {
      // If not resend, ensure User doesn't already exist
      if (!isResend) {
        const user = await getUserByEmail(normalizedEmail);
        if (user) {
          logger.warn("sendMailVerification::email_already_registered", {
            code: "ctrl_signUpDataUser_err4",
            requestId: httpRequestId,
            method: req.method,
            path: req.originalUrl || req.url,
          });
          return res.status(409).json({
            error: true,
            message: "Email already registered",
            code: "ctrl_signUpDataUser_err4",
            requestId: httpRequestId,
          });
        }
      }

      // Transaction to reset previous verification and insert a fresh one
      await conn.beginTransaction();
      await conn.execute<ResultSetHeader>(
        // Invalidate any previously active OTP without deleting history
        `UPDATE \`EmailVerification\` SET active = NULL WHERE email = ? AND active = 1`,
        [normalizedEmail]
      );
      await conn.execute<ResultSetHeader>(
        `INSERT INTO \`EmailVerification\` (id, email, code_hash, salt, password_hash, expires_at, plan_type, currency_code, active, attempts, account)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0)`,
        [
          verificationId,
          normalizedEmail,
          codeHash,
          salt,
          passwordHash,
          expiresAt,
          planCode,
          currencyCode,
        ]
      );
      await conn.commit();
    } finally {
      conn.release();
    }

    const subjects: Record<string, string> = {
      fr: "Code de vérification",
      de: "Bestätigungscode",
      en: "Verification code",
      it: "Codice di verifica",
    };
    const subject = subjects[locale] || subjects.en;
    const name = String(email).split("@")[0];
    const logoUrl = `${baseUrlUsed}/public/logo/logo_9_white.svg`;

    const { html } = await renderMjmlTemplate(
      `email.validation.${locale}.mjml`,
      { code: otp, email: name, plan: planCode, urlLogo: logoUrl },
      locale
    );

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
      // Never log email nor OTP (even in dev). If SMTP is missing, we still return the OTP to the caller (dev-only behavior).
      logger.warn("sendMailVerification::smtp_not_configured", {
        code: "ctrl_signUpDataUser_err5",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(200).json({
        ok: true,
        email: normalizedEmail,
        message: "OTP generated (no SMTP)",
        devOtp: otp,
      });
    }

    const transporter = nodemailer.createTransport({
      host: isProd
        ? process.env.MAILBOX_PROD_HOST
        : process.env.MAILBOX_DEV_HOST,
      port: isProd ? Number(process.env.MAILBOX_PROD_PORT || 465) : 465,
      secure: true,
      auth: { user: from, pass },
      tls: { rejectUnauthorized: false },
    });

    try {
      const info = await transporter.sendMail({ from, to: normalizedEmail, subject, html });
      return res.status(200).json({ status: "success", email: normalizedEmail, messageId: info.messageId, resend: isResend });
    } catch (mailErr) {
      // Email failed to send (network, SMTP). Mark OTP as inactive so the user can retry.
      try {
        const pool = await connectDb();
        const conn = await pool.getConnection();
        try {
          await conn.execute<ResultSetHeader>(
            `UPDATE \`EmailVerification\` SET active = NULL WHERE id = ?`,
            [verificationId]
          );
        } finally {
          conn.release();
        }
      } catch {}
      logger.error("sendMailVerification::smtp_send_failed", {
        code: "ctrl_signUpDataUser_err6",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
        message: (mailErr as any)?.message ?? String(mailErr),
      });
      return res.status(503).json({
        error: true,
        message: "Email service unavailable. Please retry.",
        code: "ctrl_signUpDataUser_err6",
        requestId: httpRequestId,
      });
    }
  } catch (err: any) {
    logger.error("sendMailVerification::unhandled_error", {
      code: "ctrl_signUpDataUser_err7",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
      message: err?.message ?? String(err),
    });
    return res.status(500).json({
      error: true,
      message: "Server error",
      code: "ctrl_signUpDataUser_err7",
      requestId: httpRequestId,
    });
  }
};

export { sendMailVerification };
