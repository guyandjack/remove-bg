import type { RequestHandler } from "express";
import {
  getAccessCookieOptions,
  getRefreshCookieOptions,
  rotateRefreshToken,
  signAccessToken,
} from "../function/createToken.js";
import { logger } from "../logger.js";

// Controller: issue new access/refresh tokens after middleware validation
const refreshAuth: RequestHandler = async (req, res) => {
  try {
    const data = (req as any).refresh as { jti: string; userId: string; email: string } | undefined;
    if (!data) {
      logger.warn("refreshAuth::missing_validated_refresh", {
        code: "ctrl_refreshAuth_err1",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(401).json({
        status: "error",
        message: "Missing validated refresh",
        code: "ctrl_refreshAuth_err1",
        requestId: (req as any).requestId,
      });
    }

    const newRefresh = await rotateRefreshToken({
      previousJti: data.jti,
      userId: data.userId,
      email: data.email,
      ip: req.ip,
      userAgent: req.headers["user-agent"] as string | undefined,
    });
    const accessToken = signAccessToken(
      { userId: data.userId, email: data.email, sessionId: newRefresh.jti },
    );

    res.cookie("tokenAccess", accessToken, getAccessCookieOptions());
    res.cookie("tokenRefresh", newRefresh.token, getRefreshCookieOptions());
    return res.status(200).json({ status: "success" });
  } catch (err: any) {
    logger.error("refreshAuth::unhandled_error", {
      code: "ctrl_refreshAuth_err2",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      message: err?.message || String(err),
    });
    return res.status(500).json({
      status: "error",
      message: "internal_error",
      code: "ctrl_refreshAuth_err2",
      requestId: (req as any).requestId,
    });
  }
};

export { refreshAuth };

