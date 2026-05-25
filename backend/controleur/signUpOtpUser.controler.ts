//import des librairies
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { logger } from "../logger.js";
import { computeEmailHmacSha256Hex } from "../utils/emailGuard.js";
import { renderMjmlTemplate } from "../MJML/functions/renderMjmlTemplate.js";
import { buildLogoUrl } from "../utils/publicAssetUrl.js";
import {
  createSmtpTransporter,
  resolveMailAppName,
  resolveMailSender,
} from "../utils/mailer.js";
import { resolveRequestLocale } from "../utils/locale.js";

//import des fonctions

//pour base de données
import { connectDb } from "../DB/poolConnexion/poolConnexion.js";
import {
  getUserByEmail,
  getActiveUsageBillingPeriod,
  withTransaction,
  getPlanByCode,
  getCustomerByUserId,
  createStripeCheckoutSessionState,
} from "../DB/queriesSQL/queriesSQL.js";

//pour gerer les tokens
import {
  signAccessToken,
  signRefreshToken,
  setCookieOptionsObject,
} from "../function/createToken.js";
import { getConversionQuotaSnapshotForUser } from "../DB/queriesSQL/conversionQuota.queries.js";

//pour gerer stripe
import { createCheckoutSession } from "../function/stripe/createCheckoutSession.js";

//import des spec des plan
import { planOption } from "../data/planOption.js";

//import des types
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { RequestHandler } from "express";
import type { ObjectResponse } from "./loginDataUser.controler.js";

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

const OTP_MAX_ATTEMPTS = 5;

async function sendAccountCreatedEmail(params: {
  req: any;
  toEmail: string;
  locale: "fr" | "en" | "de" | "it";
}) {
  const isProd = process.env.NODE_ENV === "production";
  try {
    const transporter = createSmtpTransporter(isProd);
    if (!transporter) {
      logger.warn("signup.account_created::smtp_not_configured", {
        // never log email
        code: "ctrl_signUpOtpUser_err1",
        requestId: (params.req as any)?.requestId,
      });
      return;
    }

    const appName = resolveMailAppName();
    const sender = resolveMailSender(isProd);
    const urlLogo = buildLogoUrl({ req: params.req, isProd });
    const name = String(params.toEmail).split("@")[0] || "";

    const baseSubjectByLocale: Record<"fr" | "en" | "de" | "it", string> = {
      fr: "Confirmation de création de compte",
      en: "Account creation confirmation",
      de: "Bestätigung der Kontoerstellung",
      it: "Conferma di creazione dell’account",
    };
    const baseSubject = baseSubjectByLocale[params.locale] || baseSubjectByLocale.en;
    const subject = isProd ? baseSubject : `[DEV] ${baseSubject}`;

    const { html: mjmlHtml } = await renderMjmlTemplate(
      `account.created.${params.locale}.mjml`,
      { email: name, urlLogo },
      params.locale
    );

    const html = mjmlHtml && mjmlHtml.trim().length > 0 ? mjmlHtml : undefined;
    await transporter.sendMail({
      from: `"${appName}" <${sender}>`,
      to: params.toEmail,
      subject,
      html,
    });
  } catch (mailErr: any) {
    logger.warn("signup.account_created::email_failed", {
      code: "ctrl_signUpOtpUser_err2",
      requestId: (params.req as any)?.requestId,
      message: mailErr?.message || String(mailErr),
    });
  }
}

const createNewAccountUser: RequestHandler = async (req, res) => {
  try {
    let { email, otp } = (req as any).userValidated || {};

    email = String(email || "")
      .trim()
      .toLowerCase();
    const code = String(otp || "").trim();

    if (!email || !code) {
      logger.warn("createNewAccountUser::missing_email_or_code", {
        code: "ctrl_signUpOtpUser_err3",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res
        .status(400)
        .json({
          status: "error",
          message: "Missing email or code",
          code: "ctrl_signUpOtpUser_err3",
          requestId: (req as any).requestId,
        });
    }

    const pool = await connectDb();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, code_hash, salt, password_hash, plan_type, currency_code, expires_at, attempts
       FROM \`EmailVerification\`
       WHERE email = ? AND active = 1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );
    const record = rows[0] as RowDataPacket | undefined;
    if (!record) {
      logger.warn("createNewAccountUser::no_active_code", {
        code: "ctrl_signUpOtpUser_err4",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res
        .status(400)
        .json({
          status: "error",
          message: "No active code",
          code: "ctrl_signUpOtpUser_err4",
          requestId: (req as any).requestId,
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
    const attempts = Number(record.attempts ?? 0);

    // Hard cap attempts to reduce brute force risk
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await pool.execute<ResultSetHeader>(
        `UPDATE \`EmailVerification\` SET active = NULL WHERE id = ?`,
        [record.id]
      );
      logger.warn("createNewAccountUser::too_many_attempts", {
        code: "ctrl_signUpOtpUser_err5",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(400).json({
        status: "error",
        message: "Too many attempts. Please request a new code.",
        code: "ctrl_signUpOtpUser_err5",
        requestId: (req as any).requestId,
      });
    }

    // If the OTP matches but is expired, cleanup to allow a fresh attempt
    if (expired && match) {
      await pool.execute<ResultSetHeader>(
        `UPDATE \`EmailVerification\` SET active = NULL WHERE id = ?`,
        [record.id]
      );
      logger.warn("createNewAccountUser::code_expired_after_match", {
        code: "ctrl_signUpOtpUser_err6",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res
        .status(400)
        .json({
          status: "error",
          message: "Code expired",
          code: "ctrl_signUpOtpUser_err6",
          requestId: (req as any).requestId,
        });
    }

    if (expired) {
      await pool.execute<ResultSetHeader>(
        `UPDATE \`EmailVerification\` SET active = NULL WHERE id = ?`,
        [record.id]
      );
      logger.warn("createNewAccountUser::code_expired", {
        code: "ctrl_signUpOtpUser_err7",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res
        .status(400)
        .json({
          status: "error",
          message: "Code expired",
          code: "ctrl_signUpOtpUser_err7",
          requestId: (req as any).requestId,
        });
    }

    if (!match) {
      await pool.execute<ResultSetHeader>(
        `UPDATE \`EmailVerification\` SET attempts = attempts + 1 WHERE id = ?`,
        [record.id]
      );
      logger.warn("createNewAccountUser::invalid_code", {
        code: "ctrl_signUpOtpUser_err8",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res
        .status(400)
        .json({
          status: "error",
          message: "Invalid code",
          code: "ctrl_signUpOtpUser_err8",
          requestId: (req as any).requestId,
        });
    }

    // Use plan directly from EmailVerification (plan_type)
    let isValidForDB = false;
    const planDefinition =
      planOption.find((option) => option.name === planCode) ||
      planOption.find((option) => option.name === "free");
    const planDailyCredit = planDefinition?.credit_IA ?? 0;

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
              // Optional hygiene: purge legacy rows that were previously stored with active=0.
              // With the new model, inactive rows are stored as active=NULL.
              `DELETE FROM \`EmailVerification\` WHERE email = ? AND active = 0`,
              [email]
            );
            await cx.execute<ResultSetHeader>(
              `UPDATE \`EmailVerification\` SET active = NULL, consumed_at = NOW() WHERE id = ?`,
              [record.id]
            );

            // 1b) Free plan anti-abuse: prevent reusing the free plan multiple times within 30 days.
            // Uses only HMAC(email_normalized) (no clear email stored) and never logs any identifier.
            const emailHmac = computeEmailHmacSha256Hex(email);
            const [grows] = await cx.execute<RowDataPacket[]>(
              `SELECT expires_at
               FROM \`free_plan_email_guard\`
               WHERE email_hmac = ?
               LIMIT 1
               FOR UPDATE`,
              [emailHmac],
            );
            const guardRow = grows[0] as any | undefined;
            if (guardRow?.expires_at) {
              const expiresAt = new Date(guardRow.expires_at);
              if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now()) {
                throw new Error("FREE_PLAN_ALREADY_USED_RECENTLY");
              }
              await cx.execute<ResultSetHeader>(
                `UPDATE \`free_plan_email_guard\`
                 SET created_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY)
                 WHERE email_hmac = ?`,
                [emailHmac],
              );
            } else {
              await cx.execute<ResultSetHeader>(
                `INSERT INTO \`free_plan_email_guard\` (email_hmac, created_at, expires_at)
                 VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
                [emailHmac],
              );
            }

            // 2) Find or create user
            const [urows] = await cx.execute<RowDataPacket[]>(
              `SELECT id FROM \`User\` WHERE email = ? LIMIT 1`,
              [email]
            );
            if (!urows[0]) {
              const id = crypto.randomUUID();
              const [ires] = await cx.execute<ResultSetHeader>(
                `INSERT INTO \`User\` (id, email, password_hash) VALUES (?, ?, ?)`,
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
              `UPDATE \`EmailVerification\` SET account = 1 WHERE id = ?`,
              [record.id]
            );

            // 4) Ensure 'free' plan exists, get its id
            let planId: string | null = null;
            const [prows] = await cx.execute<RowDataPacket[]>(
              `SELECT id FROM \`Plan\` WHERE code = ? LIMIT 1`,
              ["free"]
            );
            if (!prows[0]) {
              const pid = crypto.randomUUID();
              const [pres] = await cx.execute<ResultSetHeader>(
                `INSERT INTO \`Plan\` (id, code, name, price, currency_code, billing_interval, daily_credit_quota, is_archived)
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
              `INSERT INTO \`Subscription\` (id, user_id, plan_id, status, is_active, period_start, period_end)
             VALUES (?, ?, ?, 'active', TRUE, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))`,
              [sid, finalUserId, planId]
            );
            if (sres.affectedRows !== 1)
              throw new Error("create_subscription_failed");

            // Tokens already created before starting the transaction to avoid partial DB updates on failure
          });
        } catch (err: any) {
          if (String(err?.message || "") === "FREE_PLAN_ALREADY_USED_RECENTLY") {
            logger.warn("createNewAccountUser::free_plan_already_used_recently", {
              code: "ctrl_signUpOtpUser_err9",
              requestId: (req as any).requestId,
              method: req.method,
              path: req.originalUrl || req.url,
            });
            return res.status(409).json({
              status: "error",
              message: "Free plan already used recently.",
              code: "ctrl_signUpOtpUser_err9",
              requestId: (req as any).requestId,
            });
          }
          logger.error("createNewAccountUser::transaction_failed", {
            code: "ctrl_signUpOtpUser_err10",
            requestId: (req as any).requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            message: err?.message ?? String(err),
          });
          return res.status(500).json({
            status: "error",
            message: "internal_error",
            code: "ctrl_signUpOtpUser_err10",
            requestId: (req as any).requestId,
          });
        }

        // 2) After commit: create tokens, set cookie, get usage and respond
        const user = await getUserByEmail(email);
        if (!user) {
          logger.error("createNewAccountUser::user_missing_after_signup", {
            code: "ctrl_signUpOtpUser_err11",
            requestId: (req as any).requestId,
            method: req.method,
            path: req.originalUrl || req.url,
          });
          return res
            .status(500)
            .json({
              status: "error",
              message: "User missing after signup",
              code: "ctrl_signUpOtpUser_err11",
              requestId: (req as any).requestId,
            });
        }
        try {
          refreshToken = await signRefreshToken(email, {
            ip: req.ip,
            userAgent: req.headers["user-agent"] as string | undefined,
          });
          const decodedRefresh: any = jwt.decode(refreshToken) || {};
          const rtExp: number | undefined =
            typeof decodedRefresh?.exp === "number" ? decodedRefresh.exp : undefined;
          accessToken = signAccessToken(
            rtExp ? { email, rtExp } : { email }
          );
        } catch (err: any) {
          logger.error("createNewAccountUser::token_generation_failed", {
            code: "ctrl_signUpOtpUser_err12",
            requestId: (req as any).requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            message: err?.message ?? String(err),
          });
          return res
            .status(500)
            .json({
              status: "error",
              message: "internal_error",
              code: "ctrl_signUpOtpUser_err12",
              requestId: (req as any).requestId,
            });
        }
        const usage = await getActiveUsageBillingPeriod(user.id);
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
        const usedCredits = usage?.used_in_period ?? 0;
        const remainingCredits = usage?.remaining_in_period ?? planQuota;
        const converter = await getConversionQuotaSnapshotForUser(user.id);
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
          creditRemainingConcerter: converter?.remaining ?? 0,
          creditUsedConverter: converter?.used ?? 0,
          subscriptionId: null,
          hint: "",
        };

        // Email transactionnel (best-effort) : confirmation de création de compte (sans lien/bouton)
        void sendAccountCreatedEmail({
          req,
          toEmail: email,
          locale: resolveRequestLocale(req),
        });

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
        logger.warn("createNewAccountUser::plan_price_missing_for_checkout", {
          code: "ctrl_signUpOtpUser_err13",
          requestId: (req as any).requestId,
          method: req.method,
          path: req.originalUrl || req.url,
        });
        return res.status(400).json({
          status: "error",
          message: "Plan price missing for checkout",
          code: "ctrl_signUpOtpUser_err13",
          requestId: (req as any).requestId,
        });
      }

      await pool.execute<ResultSetHeader>(
        `UPDATE \`EmailVerification\` SET active = NULL, consumed_at = NOW() WHERE id = ?`,
        [record.id]
      );

      const response = await createCheckoutSession({
        priceId,
        email,
        planCode,
        currency: currencyCode,
      });

      if (response.status !== "success" || !response.redirect || !response.sessionId) {
        logger.error("createNewAccountUser::checkout_session_create_failed", {
          code: "ctrl_signUpOtpUser_err14",
          requestId: (req as any).requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          message: response.message,
        });
        return res.status(500).json({
          user: { email: email },
          status: response.status,
          message: "internal_error",
          code: "ctrl_signUpOtpUser_err14",
          requestId: (req as any).requestId,
          authentified: false,
          redirect: false,
          redirectUrl: "",
          plan: { code: planCode },
          credits: null,
          subscriptionId: null,
          hint: (response as any)?.hint || "",
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
    logger.error("createNewAccountUser::unhandled_error", {
      code: "ctrl_signUpOtpUser_err15",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      message: err?.message ?? String(err),
    });
    return res
      .status(500)
      .json({
        status: "error",
        message: "internal_error",
        code: "ctrl_signUpOtpUser_err15",
        requestId: (req as any).requestId,
      });
  }
};

export { createNewAccountUser };
