//import des librairies nécessaires
import bcrypt from "bcryptjs";
//import des fonctions pour les token et cookies et bdd
import {
  getAccessCookieOptions,
  getRefreshCookieOptions,
  signAccessToken,
  signRefreshToken,
} from "../function/createToken.js";
import {
  getUserByEmail,
  getCustomerByUserId,
  getPlanByCode,
  getActiveUsageBillingPeriod,
  getUserPlanAndCreditsBillingPeriod,
} from "../DB/queriesSQL/queriesSQL.js";
import { getConversionQuotaSnapshotForUser } from "../DB/queriesSQL/conversionQuota.queries.js";
import { logger } from "../logger.js";

//import des types
import type { RequestHandler } from "express";
type ObjectResponse = {
  user: {
    email: string;
    first_name: string;
    last_name: string;
  };
  status: string;
  authentified: boolean;
  redirect: boolean;
  redirectUrl: string | null;
  plan: {
    code: string;
    name: string;
    price_cents: number;
    currency: string;
    daily_credit_quota: number;
  };
  credits: {
    used_last_24h: number;
    remaining_last_24h: number;
  };
  creditRemainingConcerter: number;
  creditUsedConverter: number;

  subscriptionId: string | null;
  hint: string | null;
} | {};

// Cost 12, like account password hashes. Used only to keep unknown-email and
// bad-password attempts on comparable code paths.
const DUMMY_PASSWORD_HASH = "$2b$12$3bh5Ks6TPe36pnIISJEI7e6Lteqx1R5UYEmV83lEWSUNSOn1OZAfC";

/**
 * Login user
 */
const login: RequestHandler = async (req, res) => {
  try {
    const { email, password } = (req as any).userValidated;
    const httpRequestId = (req as any).requestId;

    // Check if email and password exist
    if (!email || !password) {
      logger.warn("login::missing_email_or_password", {
        code: "ctrl_loginDataUser_err1",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(400).json({
        status: "error",
        message: "Please provide email and password ",
        code: "ctrl_loginDataUser_err1",
        requestId: httpRequestId,
      });
    }

    // Check if user exists && password is correct
    const user = await getUserByEmail(email);

    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      // Either email wasn't found or password didn't match
      logger.warn("login::user_not_found", {
        code: "ctrl_loginDataUser_err2",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password",
        code: "ctrl_loginDataUser_err2",
        requestId: httpRequestId,
      });
    }

    const hashedPassword = user["password_hash"];

    //check password
    const isValidPassword = password
      ? await bcrypt.compare(password, hashedPassword)
      : false;

    if (!isValidPassword) {
      logger.warn("login::invalid_password", {
        code: "ctrl_loginDataUser_err3",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
      });
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password ",
        code: "ctrl_loginDataUser_err3",
        requestId: httpRequestId,
      });
    }

    let refreshToken = "";
    let accessToken = "";
    let formatedObject: ObjectResponse = {};

    try {
      const refresh = await signRefreshToken({ userId: user.id, email: user.email }, {
        ip: req.ip,
        userAgent: req.headers["user-agent"] as string | undefined,
      });
      refreshToken = refresh.token;
      accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        sessionId: refresh.jti,
      });

      //if ok get plan and credit of user, for send un formated object response
      const userId = user.id;
      //get Plan et credit available
      const planAndCredit = await getUserPlanAndCreditsBillingPeriod(userId);
      const usage = await getActiveUsageBillingPeriod(userId);

      //get info from user
      const customer = await getCustomerByUserId(userId);
      const customerFirstName = customer?.first_name ?? "";
      const customerLastName = customer?.last_name ?? "";

      const selectedPlanCode = planAndCredit?.plan ?? "";
      const planRow = await getPlanByCode(selectedPlanCode);
      const planPrice = planRow?.price ?? 0;
      const planCurrency = planRow?.currency_code ?? "CHF";
      const planQuota = planRow?.daily_credit_quota ?? 0;
      const planName = planRow?.name ?? selectedPlanCode;

      const usedCredits = usage?.used_in_period ?? 0;
      const remainingCredits =
        usage?.remaining_in_period ??
        planAndCredit?.remaining_credits_in_period ??
        planQuota;

      const converter = await getConversionQuotaSnapshotForUser(String(userId));

      formatedObject = {
        user: {
          email: email,
          first_name: customerFirstName,
          last_name: customerLastName,
        },
        status: "success",
        authentified: true,
        redirect: false,
        redirectUrl: null,
        plan: {
          code: selectedPlanCode,
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
    } catch (err) {
      logger.error("login::prepare_response_failed", {
        code: "ctrl_loginDataUser_err4",
        requestId: httpRequestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        message: (err as any)?.message ?? String(err),
      });
      return res.status(500).json({
        status: "error",
        message: "internal_error",
        code: "ctrl_loginDataUser_err4",
        requestId: httpRequestId,
      });
    }
    // Tokens are only ever returned in HttpOnly cookies, never in JSON.
    res.cookie("tokenAccess", accessToken, getAccessCookieOptions());
    res.cookie("tokenRefresh", refreshToken, getRefreshCookieOptions());
    return res.status(200).json(formatedObject);
  } catch (error) {
    logger.error("login::unhandled_error", {
      code: "ctrl_loginDataUser_err5",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      message: (error as any)?.message ?? String(error),
    });
    return res.status(500).json({
      status: "error",
      message: "internal_error",
      code: "ctrl_loginDataUser_err5",
      requestId: (req as any).requestId,
    });
  }
};

export { login, ObjectResponse};
