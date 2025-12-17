//import des librairies
import crypto from "node:crypto";

//import des fonctions

//pour base de données
import { connectDb } from "../DB/poolConnexion/poolConnexion.ts";
import {
  getUserByEmail,
  getActiveUsage24h,
  withTransaction,
  getPlanByCode,
  getCustomerByUserId,
  createStripeCheckoutSessionState,
} from "../DB/queriesSQL/queriesSQL.ts";

//pour gerer les tokens
import {
  signAccessToken,
  signRefreshToken,
  setCookieOptionsObject,
} from "../function/createToken.ts";

//pour gerer stripe
import { createCheckoutSession } from "../function/stripe/createCheckoutSession.ts";

//import des spec des plan
import { planOption } from "../data/planOption.ts";

//import des types
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { RequestHandler } from "express";
import type { ObjectResponse } from "./loginDataUser.controler.ts";

//declaration de fonctions
function hashOtp(code: string, salt: Buffer): Buffer {
  return crypto.scryptSync(code, salt, 64);
}

type CurrencyCode = "CHF" | "EUR" | "USD";

const normalizeCurrency = (code?: string | null): CurrencyCode => {
  if (!code) return "CHF";
  const upper = String(code).toUpperCase();
  return ["CHF", "EUR", "USD"].includes(upper) ? (upper as CurrencyCode) : "CHF";
};

const createNewAccountUser: RequestHandler = async (req, res) => {
  try {
    let { email, otp } = (req as any).userValidated || {};

    email = String(email || "")
      .trim()
      .toLowerCase();
    const code = String(otp || "").trim();

    if (!email || !code) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Missing email or code",
          errorCode: "otp1",
        });
    }

    const pool = await connectDb();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, code_hash, salt, password_hash, plan_type, currency_code, expires_at, attempts
       FROM EmailVerification
       WHERE email = ? AND active = 1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );
    const record = rows[0] as RowDataPacket | undefined;
    if (!record) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "No active code",
          errorCode: "otp2",
        });
    }

    const now = new Date();
    const salt: Buffer = record.salt as Buffer;
    const expected = hashOtp(code, salt);
    const stored: Buffer = record.code_hash as Buffer;
    const planCode: string = String(record.plan_type || "free").toLowerCase();
    const currencyCode = normalizeCurrency((record as any).currency_code);
    const match =
      stored.length === expected.length &&
      crypto.timingSafeEqual(stored, expected);
    const expired = new Date(record.expires_at) < now;

    // If the OTP matches but is expired, cleanup to allow a fresh attempt
    if (expired && match) {
      await pool.execute<ResultSetHeader>(
        `DELETE FROM EmailVerification WHERE email = ?`,
        [email]
      );
      return res
        .status(400)
        .json({ status: "error", message: "Code expired", errorCode: "otp3" });
    }

    if (expired) {
      await pool.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET active = 0 WHERE id = ?`,
        [record.id]
      );
      return res
        .status(400)
        .json({ status: "error", message: "Code expired", errorCode: "otp4" });
    }

    if (!match) {
      await pool.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET attempts = attempts + 1 WHERE id = ?`,
        [record.id]
      );
      return res
        .status(400)
        .json({ status: "error", message: "Invalid code", errorCode: "otp5" });
    }

    // Use plan directly from EmailVerification (plan_type)
    let isValidForDB = false;
    const planDefinition =
      planOption.find((option) => option.name === planCode) ||
      planOption.find((option) => option.name === "free");
    const planDailyCredit = planDefinition?.credit ?? 0;

    if (planCode === "free") {
      // Tokens will be created AFTER user creation to ensure DB persistence of refresh token
      let accessToken: string;
      let refreshToken: string;
      isValidForDB = true;

      // 1) Single transaction to consume OTP, create user (if needed), mark account, ensure plan, create subscription.
      if (isValidForDB) {
        let newUserId: string | null = null;
        let finalUserId: string | null = null;
        try {
          await withTransaction(async (cx) => {
            // 1) Consume/cleanup OTP rows
            await cx.execute<ResultSetHeader>(
              `DELETE FROM EmailVerification WHERE email = ? AND active = 0`,
              [email]
            );
            await cx.execute<ResultSetHeader>(
              `UPDATE EmailVerification SET active = 0, consumed_at = NOW() WHERE id = ?`,
              [record.id]
            );

            // 2) Find or create user
            const [urows] = await cx.execute<RowDataPacket[]>(
              `SELECT id FROM User WHERE email = ? LIMIT 1`,
              [email]
            );
            if (!urows[0]) {
              const id = crypto.randomUUID();
              const [ires] = await cx.execute<ResultSetHeader>(
                `INSERT INTO User (id, email, password_hash) VALUES (?, ?, ?)`,
                [id, email, String(record.password_hash)]
              );
              if (ires.affectedRows !== 1)
                throw new Error("create_user_failed");
              newUserId = id;
              finalUserId = id;
            } else {
              finalUserId = String((urows[0] as any).id);
            }

            // 3) Mark account created
            await cx.execute<ResultSetHeader>(
              `UPDATE EmailVerification SET account = 1 WHERE id = ?`,
              [record.id]
            );

            // 4) Ensure 'free' plan exists, get its id
            let planId: string | null = null;
            const [prows] = await cx.execute<RowDataPacket[]>(
              `SELECT id FROM Plan WHERE code = ? LIMIT 1`,
              ["free"]
            );
            if (!prows[0]) {
              const pid = crypto.randomUUID();
              const [pres] = await cx.execute<ResultSetHeader>(
                `INSERT INTO Plan (id, code, name, price, currency_code, billing_interval, daily_credit_quota, is_archived)
               VALUES (?, ?, 'Free', 0, 'CHF', 'month',? , 0)`,
                [pid, planCode, planDailyCredit]
              );
              if (pres.affectedRows !== 1)
                throw new Error("create_plan_failed");
              planId = pid;
            } else {
              planId = String((prows[0] as any).id);
            }

            // 5) Create active subscription
            const sid = crypto.randomUUID();
            const [sres] = await cx.execute<ResultSetHeader>(
              `INSERT INTO Subscription (id, user_id, plan_id, status, is_active, period_start, period_end)
             VALUES (?, ?, ?, 'active', TRUE, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
              [sid, finalUserId, planId]
            );
            if (sres.affectedRows !== 1)
              throw new Error("create_subscription_failed");

            // Tokens already created before starting the transaction to avoid partial DB updates on failure
          });
        } catch (err: any) {
          return res.status(500).json({
            status: "error",
            message: err?.message || String(err),
            errorCode: "otp7",
          });
        }

        // 2) After commit: create tokens, set cookie, get usage and respond
        const user = await getUserByEmail(email);
        if (!user) {
          return res
            .status(500)
            .json({
              status: "error",
              message: "User missing after signup",
              errorCode: "otp6a",
            });
        }
        try {
          accessToken = signAccessToken(email);
          refreshToken = await signRefreshToken(email, {
            ip: req.ip,
            userAgent: req.headers["user-agent"] as string | undefined,
          });
        } catch (err: any) {
          return res
            .status(500)
            .json({
              status: "error",
              message: err?.message || String(err),
              errorCode: "otp6b",
            });
        }
        const usage = await getActiveUsage24h(user.id);
        const planRow = await getPlanByCode(planCode);
        const customer = await getCustomerByUserId(user.id);
        const options = setCookieOptionsObject();
        const planConfig =
          planOption.find((option) => option.name === planCode) ||
          planOption.find((option) => option.name === "free");
        const planPrices = planConfig?.prices || planDefinition?.prices;
        const planPrice =
          (planPrices && planPrices[currencyCode]) ??
          planRow?.price ??
          planDefinition?.price ??
          0;
        const planCurrency = currencyCode || planRow?.currency_code || "CHF";
        const planQuota = planRow?.daily_credit_quota ?? planDailyCredit;
        const planName = planRow?.name ?? planDefinition?.name ?? planCode;
        const usedCredits = usage?.used_last_24h ?? 0;
        const remainingCredits = usage?.remaining_last_24h ?? planQuota;
        res.cookie("tokenRefresh", refreshToken, options);
        const formatedObject: ObjectResponse = {
          user: {
            email: email,
            first_name: customer?.first_name ?? "",
            last_name: customer?.last_name ?? "",
          },
          status: "success",
          authentified: true,
          redirect: false,
          redirectUrl: null,
          token: accessToken,
          plan: {
            code: planCode,
            name: planName,
            price_cents: planPrice,
            currency: planCurrency,
            daily_credit_quota: planQuota,
          },
          credits: {
            used_last_24h: usedCredits,
            remaining_last_24h: remainingCredits,
          },
          subscriptionId: null,
          hint: "",
        };

        return res.status(200).json(formatedObject);
      }
    }

    // Paid flow: only plan code is available here from EmailVerification.
    // Defer checkout creation until plans/stripe are configured.
    let priceId = "";
    if (planCode !== "free") {
      const planRow = await getPlanByCode(planCode);
      const planConfig = planOption.find((plan) => plan.name === planCode);
      const priceIds = planConfig?.stripePriceIds || {};
      priceId = priceIds?.[currencyCode] || "";

      if (!priceId) {
        return res.status(400).json({
          status: "error",
          message: "Plan price missing for checkout",
          errorCode: "otp_plan_price_missing",
        });
      }

      await pool.execute<ResultSetHeader>(
        `UPDATE EmailVerification SET active = 0, consumed_at = NOW() WHERE id = ?`,
        [record.id]
      );

      const response = await createCheckoutSession({
        priceId,
        email,
        planCode,
        currency: currencyCode,
      });

      if (response.status !== "success" || !response.redirect || !response.sessionId) {
        return res.status(500).json({
          user: { email: email },
          status: response.status,
          message: response.message,
          authentified: false,
          redirect: false,
          redirectUrl: "",
          plan: { code: planCode },
          credits: null,
          subscriptionId: null,
          hint: "",
        });
      }

      await createStripeCheckoutSessionState({
        sessionId: response.sessionId,
        email,
        planCode,
        planId: planRow?.id ?? null,
        currencyCode,
      });

      return res.status(200).json({
        user: { email: email },
        status: "success",
        message: "require_payment",
        authentified: false,
        redirect: true,
        redirectUrl: response.redirect,
        plan: { code: planCode },
        credits: null,
        subscriptionId: null,
        hint: "",
      });
    }
  } catch (err: any) {
    console.error("createNewAccountUser error:", err?.message || err);
    return res
      .status(500)
      .json({
        status: "error",
        message: err?.message || String(err),
        errorCode: "otp8",
      });
  }
};

export { createNewAccountUser };
