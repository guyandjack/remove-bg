import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

//import des fonctions
import { setCookieOptionsObject } from "../function/createToken.js";
import { revokeAllRefreshTokensForUser, getUserByEmail } from "../DB/queriesSQL/queriesSQL.js";
import { logger } from "../logger.js";

const logOut = async (req: Request, res: Response) => {
  const httpRequestId = (req as any).requestId;
  const options = setCookieOptionsObject();

  try {
    // Revoke all refresh tokens for this user
    const email: string | undefined = (req as any).payload;
    if (email) {
      try {
        const user = await getUserByEmail(email);
        if (user) {
          await revokeAllRefreshTokensForUser(user.id);
        }
      } catch {
        // ignore errors to keep logout idempotent
      }
    }
    res.clearCookie("tokenRefresh", options);
  } catch {
    logger.error("logOut::clear_cookie_failed", {
      code: "ctrl_logOut_err1",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res
      .status(500)
      .json({
        status: "error",
        message: "Impossible de suprimer la session",
        code: "ctrl_logOut_err1",
        requestId: httpRequestId,
      });
  }

    res.status(200).json({
      status: "success",
      email: "",
      token: "",
      credit: "",
      authentified: false,
    });
};

export { logOut };
