import type { Request, Response, NextFunction } from "express";
import { verifyRefreshToken } from "../../function/createToken.js";
import { logger } from "../../logger.js";

const checkRefreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.tokenRefresh;
    if (!token || token === "undefined" || token === "null") {
      logger.warn("checkRefreshToken::missing_token", {
        code: "mw_checkRefreshToken_err1",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
        code: "mw_checkRefreshToken_err1",
        authentified: false,
      });
    }

    try {
      const decoded: any = await verifyRefreshToken(token);
      const payload = typeof decoded === "object" ? decoded : {};
      const jti: string | undefined = payload?.jti || payload?.jwtid;
      const userId: string | undefined = payload?.userId;
      const email: string | undefined = payload?.email;
      if (!jti || !userId || !email) {
        logger.warn("checkRefreshToken::invalid_payload", {
          code: "mw_checkRefreshToken_err2",
          requestId: (req as any).requestId,
          method: req.method,
          path: req.originalUrl || req.url,
        });
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
          code: "mw_checkRefreshToken_err2",
          authentified: false,
        });
      }
      (req as any).refresh = { jti, userId, email, token };
      return next();
    } catch (err: any) {
      logger.warn("checkRefreshToken::verify_failed", {
        code: "mw_checkRefreshToken_err3",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        message: err?.message ?? String(err),
      });
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
        code: "mw_checkRefreshToken_err3",
        authentified: false,
      });
    }
  } catch (err: any) {
    logger.error("checkRefreshToken::unhandled_error", {
      code: "mw_checkRefreshToken_err4",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      message: err?.message ?? String(err),
    });
    return res.status(500).json({
      status: "error",
      message: "Server error",
      code: "mw_checkRefreshToken_err4",
      authentified: false,
    });
  }
};

export { checkRefreshToken };

