import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { setCookieOptionsObject, signAccessToken, signRefreshToken } from "../function/createToken.js";
import { revokeRefreshToken } from "../DB/queriesSQL/queriesSQL.js";
import { logger } from "../logger.js";

// Controller: issue new access/refresh tokens after middleware validation
const refreshAuth: RequestHandler = async (req, res) => {
  try {
    const data = (req as any).refresh as { jti: string; userId: string; email: string; token: string } | undefined;
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

    // Issue new tokens
    const newRefresh = await signRefreshToken(data.email, {
      ip: req.ip,
      userAgent: req.headers["user-agent"] as string | undefined,
    });

    // Decode new jti to mark rotation + expose refresh expiry to the client through the access token
    const decoded: any = jwt.decode(newRefresh) || {};
    const newJti: string | undefined = decoded?.jti || decoded?.jwtid;
    const rtExp: number | undefined =
      typeof decoded?.exp === "number" ? decoded.exp : undefined;

    const accessToken = signAccessToken(
      rtExp ? { email: data.email, rtExp } : { email: data.email }
    );
    if (newJti) {
      await revokeRefreshToken(data.jti, newJti);
    } else {
      await revokeRefreshToken(data.jti, null);
    }

    const options = setCookieOptionsObject();
    res.cookie("tokenRefresh", newRefresh, options);
    return res.status(200).json({ status: "success", token: accessToken });
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

