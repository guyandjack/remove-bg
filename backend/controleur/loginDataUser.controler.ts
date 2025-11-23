//import des librairies nécessaires
import bcrypt from "bcryptjs";

//import des fonctions pour les token et cookies et bdd
import {
  setCookieOptionsObject,
  signAccessToken,
  signRefreshToken,
} from "../function/createToken";
import {
  getUserByEmail,
  getActiveUsage24h,
  withTransaction,
  getUserPlanAndCredits24h,
  getCustomerByUserId,
  getPlanByCode,
} from "../DB/queriesSQL/queriesSQL.ts";

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
  redirectUrl: string;
  token: string;
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

  subscriptionId: string;
  hint: string;
} | {};

/**
 * Login user
 */
const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = (req as any).userValidated;

    // Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Please provide email and password ",
        codeErr: "ErrLog:1",
      });
    }

    // Check if user exists && password is correct
    const user = await getUserByEmail(email);

    if (!user) {
      // Either email wasn't found or password didn't match
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password ErrLog:2",
        codeErr: "ErrLog:2",
      });
    }

    const hashedPassword = user["password_hash"];

    //check password
    const isValidPassword = password
      ? await bcrypt.compare(password, hashedPassword)
      : false;

    if (!isValidPassword) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password ",
        codeErr: "ErrLog:3",
      });
    }

    let options = {};
    let refreshToken = "";
    let formatedObject: ObjectResponse = {};

    try {
      const accessToken = signAccessToken(user.email);
      refreshToken = await signRefreshToken(user.email, {
        ip: req.ip,
        userAgent: req.headers["user-agent"] as string | undefined,
      });
      options = setCookieOptionsObject();

      //if ok get plan and credit of user, for send un formated object response
      const userId = user.id;
      //get Plan et credit available
      const planAndCredit = await getUserPlanAndCredits24h(userId);
      const usage = await getActiveUsage24h(userId);

      //get info from user
      const customer = await getCustomerByUserId(userId);
      const customerFirstName = customer?.first_name ?? "";
      const customerLastName = customer?.last_name ?? "";

      const selectedPlanCode = planAndCredit?.plan ?? "";
      const planRow = await getPlanByCode(selectedPlanCode);
      const planPrice = planRow?.price ?? 0;
      const planCurrency = planRow?.currency ?? "EUR";
      const planQuota = planRow?.daily_credit_quota ?? 0;
      const planName = planRow?.name ?? selectedPlanCode;

      const usedCredits = usage?.used_last_24h ?? 0;
      const remainingCredits =
        usage?.remaining_last_24h ??
        planAndCredit?.remaining_credits_24h ??
        planQuota;

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
        token: accessToken,
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
        subscriptionId: null,
        hint: "",
      };
    } catch (err) {
      return res.status(500).json({
        status: "error",
        message: "serveur error: " + err,
        codeErr: "ErrLog:4",
      });
    }
    // If everything ok, send token and cookie to client

    res.cookie("tokenRefresh", refreshToken, options);
    res.status(200).json(formatedObject);
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error,
    });
  }
};

// Check if user changed password after the token was issued
/* if (user.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      status: "error",
      message: "User recently changed password. Please log in again.",
    });
  }

  // Create and send new access token
  const accessToken = signAccessToken(user.em);
  res.status(200).json({
    status: "success",
    accessToken,
    data: user.name,
  }); */

export { login, ObjectResponse};
