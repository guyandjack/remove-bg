import type { Request, Response } from "express";

//import des fonctions
import {
  getAccessCookieClearOptions,
  getRefreshCookieClearOptions,
} from "../function/createToken.js";
import { revokeAllRefreshTokensForUser, getUserByEmail } from "../DB/queriesSQL/queriesSQL.js";
import { logger } from "../logger.js";

const logOut = async (req: Request, res: Response) => {
  const httpRequestId = (req as any).requestId;

  try {
    const email: string | undefined = (req as any)?.payload?.email;
    if (email) {
      const user = await getUserByEmail(email);
      if (user) {
        // This intentionally logs out every device. The access token is tied to
        // the refresh-token record, so revocation takes effect immediately.
        await revokeAllRefreshTokensForUser(user.id);
      }
    }

    res.clearCookie("tokenAccess", getAccessCookieClearOptions());
    res.clearCookie("tokenRefresh", getRefreshCookieClearOptions());
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

    return res.status(200).json({
      status: "success",
      email: "",
      credit: "",
      authentified: false,
    });
};

export { logOut };
