import type { RequestHandler } from "express";
import {
  getStripeCheckoutSessionState,
  markStripeCheckoutSessionConsumed,
  getUserByEmail,
  getActiveUsage24h,
  getPlanByCode,
  getCustomerByUserId,
} from "../../DB/queriesSQL/queriesSQL.ts";
import {
  signAccessToken,
  signRefreshToken,
  setCookieOptionsObject,
} from "../../function/createToken.ts";
import type { ObjectResponse } from "../loginDataUser.controler.ts";
import { planOption } from "../../data/planOption.ts";

const finalizeStripeCheckout: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Missing sessionId",
      });
    }

    const record = await getStripeCheckoutSessionState(sessionId.trim());
    if (!record) {
      return res.status(404).json({
        status: "error",
        message: "unknown_session",
      });
    }

    if (record.status === "failed") {
      return res.status(400).json({
        status: "error",
        message: record.last_error || "payment_failed",
      });
    }

    if (record.status !== "completed" || !record.user_id) {
      return res.status(202).json({
        status: "pending",
        message: "waiting_for_webhook",
      });
    }

    const user = await getUserByEmail(record.email);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "user_not_found",
      });
    }

    const accessToken = signAccessToken(user.email);
    const refreshToken = await signRefreshToken(user.email, {
      ip: req.ip,
      userAgent: req.headers["user-agent"] as string | undefined,
    });
    const cookieOptions = setCookieOptionsObject();

    const usage = await getActiveUsage24h(user.id);
    const planRow = await getPlanByCode(record.plan_code);
    const customer = await getCustomerByUserId(user.id);

    const planConfig = planOption.find((plan) => plan.name === record.plan_code);
    const planPrices = planConfig?.prices;
    const currencyCodeRaw = record.currency_code || planRow?.currency_code || "CHF";
    const normalizedCurrency: "CHF" | "EUR" | "USD" =
      ["CHF", "EUR", "USD"].includes(String(currencyCodeRaw).toUpperCase())
        ? (String(currencyCodeRaw).toUpperCase() as "CHF" | "EUR" | "USD")
        : "CHF";
    const planPrice =
      (planPrices && planPrices[normalizedCurrency]) ?? planRow?.price ?? 0;
    const planCurrency = normalizedCurrency;
    const planQuota = planRow?.daily_credit_quota ?? 0;
    const planName = planRow?.name ?? record.plan_code;
    const usedCredits = usage?.used_last_24h ?? 0;
    const remainingCredits = usage?.remaining_last_24h ?? planQuota;

    const payload: ObjectResponse = {
      user: {
        email: user.email,
        first_name: customer?.first_name ?? "",
        last_name: customer?.last_name ?? "",
      },
      status: "success",
      authentified: true,
      redirect: false,
      redirectUrl: null,
      token: accessToken,
      plan: {
        code: record.plan_code,
        name: planName,
        price_cents: planPrice,
        currency: planCurrency,
        daily_credit_quota: planQuota,
      },
      credits: {
        used_last_24h: usedCredits,
        remaining_last_24h: remainingCredits,
      },
      subscriptionId: record.subscription_id ?? null,
      hint: "",
    };

    

    await markStripeCheckoutSessionConsumed(record.session_id);
    res.cookie("tokenRefresh", refreshToken, cookieOptions);
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error("finalizeStripeCheckout error:", err?.message || err);
    return res.status(500).json({
      status: "error",
      message: err?.message || String(err),
    });
  }
};

export { finalizeStripeCheckout };
