//import des librairies nécessaires
import bcrypt from "bcryptjs"


//import des fonctions pour les token et cookies et bdd
import { setCookieOptionsObject, signAccessToken, signRefreshToken } from "../function/createToken";
import { getUserByEmail, getActiveUsage24h, withTransaction,getUserPlanAndCredits24h} from "../DB/queriesSQL/queriesSQL.ts";

//import des types
import type { RequestHandler } from "express";


/**
 * Login user
 */
const login :RequestHandler = async (req, res, next) => {
  try {
    const { email, password} = (req as any).userValidated;

    // Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Please provide email and password ErrLog:1",
      });
    }

    // Check if user exists && password is correct
    const user = await getUserByEmail(email);

    if (!user) {
      // Either email wasn't found or password didn't match
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password ErrLog:2",
      });
    }

    const hashedPassword = user["password_hash"];

    //check password
    const isValidPassword = password ? await bcrypt.compare(password, hashedPassword) : false;

    if (!isValidPassword) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password ErrLog:3",
      });
    }

    
    // If everything ok, send token and cookie to client
    const accessToken = signAccessToken(user.email);
    const refreshToken = signRefreshToken(user.email);
    const options = setCookieOptionsObject();

    //if ok get plan and credit of user, for send un formated object response
    const userId = user.id;
    //get Plan et credit available
    const planAndCredit = await getUserPlanAndCredits24h(userId);
    const usage = await getActiveUsage24h(userId);

    let formatedObject = {
      user: { email: email },
      status: "success",
      authentified: true,
      redirect: false,
      redirectUrl: null,
      token: accessToken,
      plan: { code: planAndCredit?.plan, name: planAndCredit?.plan, price_cents: 0, currency: "EUR", daily_credit_quota: 2 },
      credits: usage ? { used_last_24h: usage.used_last_24h, remaining_last_24h: usage.remaining_last_24h } : null,
      subscriptionId: null,
      hint: ""
    }

    
    res.cookie("tokenRefresh", refreshToken, options);
    res.status(200).json(formatedObject);
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error
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


export {login}




