// signup email verification controller
import type { RequestHandler } from "express";
import nodemailer from "nodemailer";
import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectDb, disconnectDb} from "../DB/poolConnexion/poolConnexion.ts";
import { renderMjmlTemplate } from "../MJML/functions/renderMjmlTemplate.ts";

//types
interface AttemptRow extends RowDataPacket {
  attempt: number;
}

function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtp(code: string, salt: Buffer): Buffer {
  return crypto.scryptSync(code, salt, 64);
}

// Helpers
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
    const { email, password, lang, id } = (req as any).userValidated || {};
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: true, message: "Missing email" });
    }

    const locale = resolveLocale(lang);
    const isResend = String(id || "").toLowerCase() === "resend";

    // 1) Generate OTP and hashes
    const otp = generateOtp();
    const salt = crypto.randomBytes(16);
    const codeHash = hashOtp(otp, salt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(String(password), 12);
    } else {
      return res.status(400).json({ error: true, message: "Missing password" });
    }

    if (!passwordHash) {
      return res
        .status(400)
        .json({ error: true, message: "Error making password" });
    }

    // 2) Store in DB (deactivate previous actives and insert)
    const pool = await connectDb();
    const conn = await pool.getConnection();
    try {
      // si click "resend" autorise l' envoi d' un nouveau mail
      if (isResend) {
        try {
          await conn.beginTransaction();

          const [rows] = await conn.execute<AttemptRow[]>(
            "SELECT attempts, account FROM EmailVerification WHERE email = ? LIMIT 1",
            [normalizedEmail]
          );

          const isAccount = rows[0].account === 1;
          const attemptsNumber = rows[0].attempts;
            console.log("tableau params requet SQL: ", [{ key: attemptsNumber }, { key: isAccount }]);

          //controle des tentatives
          if (rows.length > 0 && attemptsNumber >= 10) {
            return res.status(400).json({
              error: true,
              message:
                "Nombre de tentatives dépassées, veuillez réessayer dans 5 min",
            });
          }
          //controle si un compte existe deja
          if (isAccount) {
            return res.status(400).json({
              error: true,
              message: "Couple identifiant mot de passe deja utilisé",
            });
          }

          //netoyage de la bdd pour eviter erreur de duplication
          await conn.execute<ResultSetHeader>(
            "DELETE FROM EmailVerification WHERE email = ?",
            [normalizedEmail]
          );

          //nouvel insertion
            const id = crypto.randomUUID();
            console.log("tableau params requet SQL: ", [
                { key1: id }, 
                { key1: normalizedEmail }, 
              { key1: codeHash }, 
              { key1: salt }, 
              { key1: passwordHash }, 
              { key1: expiresAt }, 
              { key1: attemptsNumber },
            ]);
          const row2 = await conn.execute<ResultSetHeader>(
            `INSERT INTO EmailVerification (id, email, code_hash, salt, password_hash, expires_at, active, attempts, account)
         VALUES (?, ?, ?, ?, ?, ?, 1,?, 0)`,
            [
              id,
              normalizedEmail,
              codeHash,
              salt,
              passwordHash,
              expiresAt,
            attemptsNumber,
              
            ]
          );

          if (!row2[0]) {
            return res
              .status(400)
              .json({ error: true, message: "impossible to resend (1)" });
          }

          await conn.commit();
        } catch (err: any) {
          return res
            .status(400)
            .json({ error: true, message: "impossible to resend (2)" + err });
        }
      } else {
        try {
          //verify si un compte existe avec cet email
          const [rows] = await conn.execute<AttemptRow[]>(
            "SELECT account FROM EmailVerification WHERE email = ? LIMIT 1",
            [normalizedEmail]
          );
            let isAccount = rows[0]?.account === 1
            console.log("isAccount: ", isAccount);
          if (isAccount) {
            return res.status(400).json({
              error: true,
              message: "Couple identifiant mot de passe deja utilisé",
            });
          }

          const id = crypto.randomUUID();
          await conn.execute<ResultSetHeader>(
            `INSERT INTO EmailVerification (id, email, code_hash, salt, password_hash, expires_at, active, attempts, account)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0)`,
            [id, normalizedEmail, codeHash, salt, passwordHash, expiresAt]
          );
        } catch (err: any) {
          // mysql2 fournit err.code === 'ER_DUP_ENTRY' et err.errno === 1062
          if (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062) {
            return res.status(400).json({
              error: true,
              message: "Identifiant ou mot de passe deja utilisé(2)",
              errorCode: err?.code || err?.errno,
            });
          }
          return res
            .status(400)
            .json({ error: true, message: "erreur:" + err });
        }
      }
    } catch (dbTxErr) {
      throw dbTxErr;
    } finally {
      conn.release();
    }

    // 3) Prepare email (MJML template -> HTML)
    const subjects: Record<string, string> = {
      fr: "Code de vérification",
      de: "Bestätigungscode",
      en: "Verification code",
      it: "Codice di verifica",
    };
    const subject = subjects[locale] || subjects.en;
    const name = email.split("@")[0];

    // Use existing MJML templating system
    const { html } = await renderMjmlTemplate(
      `email.validation.${locale}.mjml`,
      {
        code: otp,
        email: name,
      },
      locale
    );

    // 4) Send email via nodemailer
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
      console.warn("SMTP credentials missing; logging OTP in dev:", {
        email: normalizedEmail,
        otp,
      });
      return res.status(200).json({
        ok: true,
        email: normalizedEmail,
        message: "OTP generated (no SMTP)",
        devOtp: otp,
      });
    }

    const transporter = nodemailer.createTransport({
      host: isProd ? process.env.MAILBOX_PROD_HOST : "smtp.gmail.com",
      port: isProd ? Number(process.env.MAILBOX_PROD_PORT || 465) : 465,
      secure: true,
      auth: { user: from, pass },
      tls: { rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
      from,
      to: normalizedEmail,
      subject,
      html,
    });

    return res.status(200).json({
      status: "success",
      email: normalizedEmail,
      messageId: info.messageId,
      resend: isResend,
    });
  } catch (err: any) {
    console.error("sendMailVerification error:", err?.message || err);
    return res.status(500).json({ error: true, message: "Server error" + err });
  }
};

export default sendMailVerification;
