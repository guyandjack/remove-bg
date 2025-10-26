import type { Request, Response, RequestHandler } from "express";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import "dotenv/config";
import bcrypt from "bcryptjs";
import { renderMjmlTemplate } from "../../MJML/functions/renderMjmlTemplate";
import { connectDb } from "../../DB/poolConnexion/poolConnexion";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createUser } from "../../DB/queriesSQL/queriesSQL";

// SMTP (Gmail) via .env
const SMTP_HOST = process.env.MAILBOX_DEV_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.MAILBOX_DEV_PORT || 465);
const SMTP_SECURE = SMTP_PORT === 465; // true pour 465, false pour 587
const SMTP_USER = process.env.MAILBOX_DEV_ADRESS;
const SMTP_PASS = process.env.MAILBOX_DEV_PASSWORD;

// OTP aléatoire (6 chiffres) puis hashé et stocké en DB (OTP-only flow)
function generateRandomOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// permet de hasher le code OTP avant stockage damns la bdd
function hashOtp(code: string, salt: Buffer): Buffer {
  return crypto.scryptSync(code, salt, 64);
}


//Envoi un mail de verivication au client qui souhaite creer un compte ou faire un achat
export const sendVerificationEmail: RequestHandler = async (req, _res, next) => {
  const email = ((req as any).userValidated?.email as string | undefined)?.trim().toLowerCase();
  const lang = (req as any).userValidated?.lang as string | "en";
  const password = (req as any).userValidated?.password as string;
  if (!email || !lang || !password) {
  console.error("donnée manquante dans le corps de requete");
  return next();

  } 
  const otp = generateRandomOtp();
  const salt = crypto.randomBytes(16);
  const codeHash = hashOtp(otp, salt);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  // Hash du mot de passe (bcrypt en async)
  let passwordHash: string;
  try {
    passwordHash = await bcrypt.hash(password, 12);
  } catch (e) {
    console.error("❌ Bcrypt hash failed:", (e as Error).message);
    return next();
  }

  try {
    const pool = await connectDb();
    // Désactiver d'éventuels codes actifs précédents
    await pool.execute<ResultSetHeader>(
      "UPDATE EmailVerification SET active = 0 WHERE email = ? AND active = 1",
      [email]
    );

    const id = crypto.randomUUID();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO EmailVerification (id, email, code_hash, salt, password_hash, expires_at, active, attempts)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
      [id, email, codeHash, salt, passwordHash, expiresAt]
    );
  } catch (dbErr: any) {
    console.error("❌ DB error (store OTP):", dbErr?.message || dbErr);
    return next();
  }

  // SMTP non configuré → log le code et continuer
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[emailVerification] SMTP creds missing, OTP only:", { email, otp });
    return next();
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER as string, pass: SMTP_PASS as string },
    tls: { rejectUnauthorized: false },
  });

  const { html } = await renderMjmlTemplate(`email.validation.${lang}.mjml`, { code: otp }, lang);

  // Sujet selon la langue
  const subjects: Record<string, string> = {
    fr: "Code de vérification",
    de: "Bestätigungscode",
    en: "Verification code",
    it: "Codice di verifica",
  };
  const subjectEmail = subjects[lang] || subjects["en"];

  const mailOptions = {
    from: SMTP_USER as string,
    to: email,
    subject: subjectEmail,
    html: html,
  } as nodemailer.SendMailOptions;

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 OTP email sent:", info.messageId);
    next();
  } catch (err: any) {
    console.error("❌ Failed to send OTP email:", err?.message || err);
    next();
  }
};


//fonction qui verifie le code envoyé par le client, pour valider son email.
export const verifyEmailCodeController: RequestHandler = (req: Request, res: Response) => {
  (async () => {
    const email = (req.body?.email as string | undefined)?.trim().toLowerCase();
    const code = (req.body?.code as string | undefined)?.trim();
    if (!email || !code) {
      return res.status(400).json({ error: true, message: "Missing email or code" });
    }

    try {
      const pool = await connectDb();
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, code_hash, salt, password_hash, expires_at, attempts
         FROM EmailVerification
         WHERE email = ? AND active = 1
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
      );

      const record = rows[0];
      if (!record) {
        return res.status(400).json({ error: true, message: "No active code" });
      }

      const now = new Date();
      if (new Date(record.expires_at) < now) {
        await pool.execute<ResultSetHeader>(
          `UPDATE EmailVerification SET active = 0 WHERE id = ?`,
          [record.id]
        );
        return res.status(400).json({ error: true, message: "Code expired" });
      }

      const salt: Buffer = record.salt as Buffer;
      const expected = hashOtp(code, salt);
      const stored: Buffer = record.code_hash as Buffer;
      const match = stored.length === expected.length && crypto.timingSafeEqual(stored, expected);

      if (!match) {
        await pool.execute<ResultSetHeader>(
          `UPDATE EmailVerification SET attempts = attempts + 1 WHERE id = ?`,
          [record.id]
        );
        return res.status(400).json({ error: true, message: "Invalid code" });
      }

      // Créer l'utilisateur avec le hash stocké si non existant
      try {
        await createUser(email, record.password_hash as string);
      } catch (userErr: any) {
        // Conflit unique si déjà existant — on ignore
        console.warn("ℹ️ createUser warning:", userErr?.message || userErr);
      }

      await pool.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET active = 0, consumed_at = NOW() WHERE id = ?`,
        [record.id]
      );
      return res.status(200).json({ ok: true, email, message: "Code verified" });
    } catch (err: any) {
      console.error("❌ DB error (verify OTP):", err?.message || err);
      return res.status(500).json({ error: true, message: "Server error" });
    }
  })();
};
