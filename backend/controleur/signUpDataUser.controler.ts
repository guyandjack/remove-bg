// signup email verification controller (robust, aligned with schema)
import type { RequestHandler } from "express";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2/promise";
import { connectDb } from "../DB/poolConnexion/poolConnexion.ts";
import { renderMjmlTemplate } from "../MJML/functions/renderMjmlTemplate.ts";
import { getPlanByCode, getUserByEmail } from "../DB/queriesSQL/queriesSQL.ts";

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

export const sendMailVerification: RequestHandler = async (req, res) => {
  try {
    const { email, password, lang, id, plan } = (req as any).userValidated || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: true, message: "Missing email" });
    }

    const locale = resolveLocale(lang);
    const isResend = String(id || "").toLowerCase() === "resend";
    
    const planCode = String(plan).toLowerCase();
    /* const planRow = await getPlanByCode(planCode);
    if (!planRow) {
      return res.status(400).json({ error: true, message: "Invalid plan" });
    } */

    const otp = generateOtp();
    const salt = crypto.randomBytes(16);
    const codeHash = hashOtp(otp, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    const passwordHash = password ? await bcrypt.hash(String(password), 12) : null;
    if (!passwordHash) {
      return res.status(400).json({ error: true, message: "Missing password" });
    }

    const pool = await connectDb();
    const conn = await pool.getConnection();
    try {
      if (isResend) {
        
        // Minimal latency: single UPSERT on unique (email, active)
        const idNew = crypto.randomUUID();
        await conn.execute<ResultSetHeader>(
          `INSERT INTO EmailVerification (id, email, code_hash, salt, password_hash, expires_at, plan_type, active, attempts, account)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0)
           ON DUPLICATE KEY UPDATE
             code_hash = VALUES(code_hash),
             salt = VALUES(salt),
             password_hash = VALUES(password_hash),
             expires_at = VALUES(expires_at),
             plan_type = VALUES(plan_type),
             attempts = 0,
             account = 0,
             updated_at = CURRENT_TIMESTAMP,
             active = 1`,
          [idNew, normalizedEmail, codeHash, salt, passwordHash, expiresAt, planCode]
        );
      } else {
        
        // Enforce global uniqueness on User
        const user = await getUserByEmail(normalizedEmail);
        if (user) {
          return res.status(400).json({ error: true, message: "Couple identifiant mot de passe deja utilisé" });
        }
        const idNew = crypto.randomUUID();
        await conn.execute<ResultSetHeader>(
          `INSERT INTO EmailVerification (id, email, code_hash, salt, password_hash, expires_at, plan_type, active, attempts, account)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 0)`,
          [idNew, normalizedEmail, codeHash, salt, passwordHash, expiresAt, planCode]
        );
      }
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

    const { html } = await renderMjmlTemplate(
      `email.validation.${locale}.mjml`,
      { code: otp, email: name, plan: planCode },
      locale
    );

    const isProd = process.env.NODE_ENV === "production";
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

    const info = await transporter.sendMail({ from, to: normalizedEmail, subject, html });
    return res.status(200).json({ status: "success", email: normalizedEmail, messageId: info.messageId, resend: isResend });
  } catch (err: any) {
    console.error("sendMailVerification error:", err?.message || err);
    return res.status(500).json({ error: true, message: "Server error" + err });
  }
};

export default sendMailVerification;

