// signup email verification controller (robust, aligned with schema)
import type { RequestHandler } from "express";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2/promise";
import { connectDb } from "../DB/poolConnexion/poolConnexion.ts";
import { renderMjmlTemplate } from "../MJML/functions/renderMjmlTemplate.ts";
import { getUserByEmail } from "../DB/queriesSQL/queriesSQL.ts";
import { planOption } from "../data/planOption.ts";
import { buildLogoUrl } from "../utils/publicAssetUrl.ts";

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

function resolveLocale(lang: unknown): string {
  const l = String(lang || "en").toLowerCase();
  return ["fr", "de", "en", "it"].includes(l) ? l : "en";
}

const sendMailVerification: RequestHandler = async (req, res) => {
  const nodEnv = process.env.NODE_ENV || null;
  const baseUrlProd = process.env.BASE_URL_PROD || null;
  const baseUrlDev = process.env.BASE_URL_DEV || null;
  if (!baseUrlDev || !baseUrlProd || !nodEnv) {
    return res.status(500).json({
      error: true,
      message: "Missing env values",
      code: "signup_missing_env",})
    }
  const isProd = nodEnv === "production";
  const baseUrlUsed = isProd ? baseUrlProd : baseUrlDev ;
  try {
    const { email, password, lang, plan, id, currency } = (req as any).userValidated || {};

    // Basic required fields
    if (!email || !lang || !password || !plan || !currency) {
      return res.status(400).json({
        error: true,
        message: "Missing required fields (email, password, lang, plan, currency)",
        code: "signup_missing_fields",
      });
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: true, message: "Invalid email", code: "signup_invalid_email" });
    }

    const locale = resolveLocale(lang);
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

    const pool = await connectDb();
    const conn = await pool.getConnection();
    try {
      // If not resend, ensure User doesn't already exist
      if (!isResend) {
        const user = await getUserByEmail(normalizedEmail);
        if (user) {
          return res.status(409).json({ error: true, message: "Email already registered", code: "signup_email_exists" });
        }
      }

      // Transaction to reset previous verification and insert a fresh one
      await conn.beginTransaction();
      await conn.execute<ResultSetHeader>(
        `DELETE FROM EmailVerification WHERE email = ?`,
        [normalizedEmail]
      );
      const idNew = crypto.randomUUID();
      await conn.execute<ResultSetHeader>(
        `INSERT INTO EmailVerification (id, email, code_hash, salt, password_hash, expires_at, plan_type, currency_code, active, attempts, account)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0)`,
        [
          idNew,
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
      console.warn("SMTP credentials missing; logging OTP in dev:", { email: normalizedEmail, otp });
      return res.status(200).json({ ok: true, email: normalizedEmail, message: "OTP generated (no SMTP)", devOtp: otp });
    }

    const transporter = nodemailer.createTransport({
      host: isProd ? process.env.MAILBOX_PROD_HOST : "smtp.gmail.com",
      port: isProd ? Number(process.env.MAILBOX_PROD_PORT || 465) : 465,
      secure: true,
      auth: { user: from, pass },
      tls: { rejectUnauthorized: false },
    });

    try {
      const info = await transporter.sendMail({ from, to: normalizedEmail, subject, html });
      return res.status(200).json({ status: "success", email: normalizedEmail, messageId: info.messageId, resend: isResend });
    } catch (mailErr) {
      // Email failed to send (network, SMTP). Clean up verification row so user can retry.
      try {
        const pool = await connectDb();
        const conn = await pool.getConnection();
        try {
          await conn.execute<ResultSetHeader>(
            `DELETE FROM EmailVerification WHERE email = ?`,
            [normalizedEmail]
          );
        } finally {
          conn.release();
        }
      } catch {}
      return res.status(503).json({ error: true, message: "Email service unavailable. Please retry.", code: "smtp_unavailable" });
    }
  } catch (err: any) {
    console.error("sendMailVerification error:", err?.message || err);
    return res.status(500).json({ error: true, message: "Server error", code: "signup_server_error" });
  }
};

export { sendMailVerification };
