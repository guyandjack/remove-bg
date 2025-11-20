import type { Request, Response, NextFunction } from "express";
import { verifyRefreshToken } from "../../function/createToken";

const checkRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.tokenRefresh;
    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({ status: "error", message: "Missing refresh token", codeErr: "refresh_0" });
    }

    try {
      const decoded: any = await verifyRefreshToken(token);
      const payload = typeof decoded === "object" ? decoded : {};
      const jti: string | undefined = payload?.jti || payload?.jwtid;
      const userId: string | undefined = payload?.userId;
      const email: string | undefined = payload?.email;
      if (!jti || !userId || !email) {
        return res.status(401).json({ status: "error", message: "Invalid refresh token payload", codeErr: "refresh_1" });
      }
      (req as any).refresh = { jti, userId, email, token };
      return next();
    } catch (err: any) {
      return res.status(401).json({ status: "error", message: err?.message || "Invalid or expired refresh token", codeErr: "refresh_2" });
    }
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err?.message || String(err), codeErr: "refresh_3" });
  }
};

export { checkRefreshToken };

