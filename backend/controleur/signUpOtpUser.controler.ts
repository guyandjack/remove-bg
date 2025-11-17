import type { RequestHandler } from "express";
import crypto from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectDb } from "../DB/poolConnexion/poolConnexion.ts";
import {
  createUser,
  getUserByEmail,
  upsertPlanByCode,
  createSubscription,
  getActiveUsage24h,
  withTransaction,
} from "../DB/queriesSQL/queriesSQL.ts";
import { signAccessToken, signRefreshToken, setCookieOptionsObject } from "../function/createToken.ts";

function hashOtp(code: string, salt: Buffer): Buffer {
  return crypto.scryptSync(code, salt, 64);
}

const createNewAccountUser: RequestHandler = async (req, res) => {
  try {
    let { email, otp } = (req as any).userValidated || {};
    
    email = String(email || "").trim().toLowerCase();
    const code = String(otp || "").trim();

    if (!email || !code) {
      return res.status(400).json({ status: "error", message: "Missing email or code", errorCode: "otp1" });
    }

    const pool = await connectDb();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, code_hash, salt, password_hash, plan_type, expires_at, attempts
       FROM EmailVerification
       WHERE email = ? AND active = 1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    const record = rows[0] as any;
    if (!record) {
      return res.status(400).json({ status: "error", message: "No active code", errorCode: "otp2" });
    }

    const now = new Date();
    const salt: Buffer = record.salt as Buffer;
    const expected = hashOtp(code, salt);
    const stored: Buffer = record.code_hash as Buffer;
    const planCode: string = String(record.plan_type || "free").toLowerCase();
    const match = stored.length === expected.length && crypto.timingSafeEqual(stored, expected);
    const expired = new Date(record.expires_at) < now;

    // If the OTP matches but is expired, cleanup to allow a fresh attempt
    if (expired && match) {
      await pool.execute<ResultSetHeader>(
        `DELETE FROM EmailVerification WHERE email = ?`,
        [email]
      );
      return res.status(400).json({ status: "error", message: "Code expired", errorCode: "otp3" });
    }

    if (expired) {
      await pool.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET active = 0 WHERE id = ?`,
        [record.id]
      );
      return res.status(400).json({ status: "error", message: "Code expired", errorCode: "otp4" });
    }

    if (!match) {
      await pool.execute<ResultSetHeader>(`UPDATE EmailVerification SET attempts = attempts + 1 WHERE id = ?`, [record.id]);
      return res.status(400).json({ status: "error", message: "Invalid code", errorCode: "otp5" });
    }
    
    
      
    // Mark OTP as consumed; avoid UNIQUE(email, active) conflicts by cleaning inactive rows first
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute<ResultSetHeader>(
        `DELETE FROM EmailVerification WHERE email = ? AND active = 0`,
        [email]
      );
      await conn.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET active = 0, consumed_at = NOW() WHERE id = ?`,
        [record.id]
      );
      await conn.commit();
    } finally {
      // ensure connection is always released
      // @ts-ignore
      conn.release && conn.release();
    }
      
   


    // Use plan directly from EmailVerification (plan_type)
    if (planCode === "free") {
      // For free: create user, then active subscription, then return tokens
      let user = await getUserByEmail(email);
      if (!user) {
        const newId = await createUser(email, record.password_hash as string);
        if (!newId) {
          return res.status(400).json({ status: "error", message: "Impossible to create user", errorCode: "otp6" });
        }
        user = await getUserByEmail(email);
      }

      // Mark account as created in EmailVerification
      await pool.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET account = 1 WHERE id = ?`,
        [record.id]
      );

      // Ensure 'free' plan exists and get its id without separate lookup
      const planId = await upsertPlanByCode({ code: "free", name: "Free", price: 0, daily_credit_quota: 2 });
      const subId = await createSubscription({ userId: user!.id, planId, isActive: true });
      const usage = await getActiveUsage24h(user!.id);

      const accessToken = signAccessToken({ email });
      const refreshToken = signRefreshToken(email);
      const options = setCookieOptionsObject();
      res.cookie("tokenRefresh", refreshToken, options);

      return res.status(200).json({
        user: {email: email},
        status: "success",
        authentified: true,
        redirect: false,
        redirectUrl: null,
        token: accessToken,
        plan: { code: "free", name: "Free", price_cents: 0, currency: "EUR", daily_credit_quota: 2 },
        credits: usage ? { used_last_24h: usage.used_last_24h, remaining_last_24h: usage.remaining_last_24h } : null,
        subscriptionId: subId,
        hint:""
      });
    }

    // Paid flow: only plan code is available here from EmailVerification.
    // Defer checkout creation until plans/stripe are configured.
    return res.status(200).json({
      user:{email: email},
      status: "requires_payment",
      authentified: false,
      redirect: true,
      redirectUrl: "https://stripe.com",
      plan: { code: planCode },
      credits: null,
      subscriptionId: null,
      hint: "Configure plans and Stripe (price id) to enable checkout",
    });
  } catch (err: any) {
    console.error("createNewAccountUser error:", err?.message || err);
    return res.status(500).json({ status: "error", message: err?.message || String(err), errorCode: "otp7" });
  }
};

export { createNewAccountUser };
