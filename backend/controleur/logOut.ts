import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

//import des fonctions
import { setCookieOptionsObject } from "../function/createToken";
import { revokeAllRefreshTokensForUser, getUserByEmail } from "../DB/queriesSQL/queriesSQL.ts";

const logOut = async (req: Request, res: Response) => {
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
    return res
      .status(500)
      .json({
        status: "error",
        message: "Impossible de suprimer la session",
        errorCode: "out1",
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
