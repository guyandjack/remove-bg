// middleware/verifyAuth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../../function/createToken.js";
import { logger } from "../../logger.js";

const verifyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = typeof req.cookies?.tokenAccess === "string" ? req.cookies.tokenAccess.trim() : "";

  const looksMalformed =
    !token ||
    token === "undefined" ||
    token === "null" ||
    token.split(".").length !== 3;

  if (looksMalformed) {
    logger.warn("verifyAuth::missing_or_malformed_token", {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      hasAccessCookie: Boolean(token),
      code: "mw_verifyAuth_err1",
    });
    return res.status(401).set("Cache-Control", "no-store").json({
      status: "error",
      message: "Unauthorized",
      code: "mw_verifyAuth_err1",
    });
  }

  try {
    const decoded = await verifyAccessToken(token);
    if (!decoded.email || !decoded.userId) {
      logger.warn("verifyAuth::invalid_token_payload", {
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        code: "mw_verifyAuth_err2",
      });
      return res.status(401).set("Cache-Control", "no-store").json({
        status: "error",
        message: "Unauthorized",
        code: "mw_verifyAuth_err2",
      });
    }
    
    (req as any).payload = {
      ...(req as any).payload,
      email: decoded.email,
      userId: decoded.userId,
      sessionId: decoded.sessionId,
    };
    return next();
  } catch (err: any) {
    logger.warn("verifyAuth::verify_failed", {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      code: "mw_verifyAuth_err3",
      message: err?.message ?? String(err),
    });
    return res.status(401).set("Cache-Control", "no-store").json({
      status: "error",
      message: "Unauthorized",
      code: "mw_verifyAuth_err3",
    });
  }
};

export { verifyAuth };
