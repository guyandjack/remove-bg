//fonction qui verifie le code envoyé par le client, pour valider son email.
import type { Request, Response, RequestHandler } from "express";
//import nodemailer from "nodemailer";
import crypto from "node:crypto";
import "dotenv/config";
//import bcrypt from "bcryptjs";
//import { renderMjmlTemplate } from "../../MJML/functions/renderMjmlTemplate";
import { connectDb } from "../../DB/poolConnexion/poolConnexion";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createUser } from "../../DB/queriesSQL/queriesSQL";



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