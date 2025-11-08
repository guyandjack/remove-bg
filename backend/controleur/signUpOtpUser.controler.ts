import type { RequestHandler } from "express";
import crypto from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectDb } from "../DB/poolConnexion/poolConnexion.ts";
import { createUser } from "../DB/queriesSQL/queriesSQL.ts";
import {signAccessToken, signRefreshToken, setCookieOptionsObject} from "../function/createToken.ts"

function hashOtp(code: string, salt: Buffer): Buffer {
  return crypto.scryptSync(code, salt, 64);
}

const createNewAccountUser: RequestHandler = async (req, res) => {
  try {
    const ctx = (req as any).userValidated || {};
    const email = String(ctx.email || "")
      .trim()
      .toLowerCase();
    // accept several possible keys due to earlier naming typos
    const code = String(
      ctx.codeOtp || ctx.codeOdt || ctx.odt || ctx.otp || ""
    ).trim();

    if (!email || !code) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing email or code", errorCode: "otp1" });
    }

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
      return res
        .status(400)
        .json({
          status: "error",
          message: "No active code",
          errorCode: "otp2",
        });
    }

    //controle de l' expiration de code OTP
    const now = new Date();
    if (new Date(record.expires_at) < now) {
      await pool.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET active = 0 WHERE id = ?`,
        [record.id]
      );
      return res
        .status(400)
        .json({ status: "error", message: "Code expired", errorCode: "otp3" });
    }

    const salt: Buffer = record.salt as Buffer;
    const expected = hashOtp(code, salt);
    const stored: Buffer = record.code_hash as Buffer;
    const match =
      stored.length === expected.length &&
      crypto.timingSafeEqual(stored, expected);

    if (!match) {
      await pool.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET attempts = attempts + 1, WHERE id = ?`,
        [record.id]
      );
      return res
        .status(400)
        .json({ status: "error", message: "Invalid code", errorCode: "otp4" });
    }

    // Create user with stored password_hash if not exists (ignore unique conflict)
    try {
      await createUser(email, record.password_hash as string);
    } catch (userErr: any) {
      return res
        .status(400)
        .json({ status: "error", message: "Impossible to record", errorCode: "otp5" });
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE EmailVerification SET active = 0, consumed_at = NOW(), account = 1 WHERE id = ?`,
      [record.id]
    );

    //attribution du plan free
    await pool.execute<ResultSetHeader>(
      `UPDATE EmailVerification SET active = 0, consumed_at = NOW(), account = 1 WHERE id = ?`,
      [record.id]
    );

    //attribution d'un token a l' utilisateur
    // Utilise l'email validé (variable locale) et le format d'objet attendu
    const accessToken = signAccessToken({ email });
    const refreshToken = signRefreshToken(email);
    const options = setCookieOptionsObject();
    console.log("acccess token dans le controleur signup: ", accessToken);
    res.cookie("tokenRefresh", refreshToken, options);
    res.status(200).json({
      status: "success",
      email: email,
      token: accessToken,
      credit: 5,
      authentified: true
           
    });
  } catch (err: any) {
    console.error("createNewAccountUser error:", err?.message || err);
    return res.status(500).json({ status: "error", message: err || err.message, errorCode: "otp6" });
  }
  
}
export { createNewAccountUser }
