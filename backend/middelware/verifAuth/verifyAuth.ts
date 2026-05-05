// middleware/verifyAuth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../../function/createToken.js";
import { logger } from "../../logger.js";

const verifyAuth = (req: Request, res: Response, next: NextFunction) => {
  const rawAuth = req.headers.authorization;
  const token = rawAuth?.split(" ")[1]?.trim();

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
      hasAuthHeader: Boolean(rawAuth),
      errorCode: "veri1",
    });
    return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({ status: "error", message: "No token", errorCode: "veri1" });
  }

  try {
    const decoded: any = verifyAccessToken(token);
    let email: string | undefined;
    if (decoded && typeof decoded === "object") {
      if (typeof decoded.email === "string") email = decoded.email;
      else if (decoded.payload && typeof decoded.payload === "object") email = decoded.payload.email;
      else if (typeof decoded.payload === "string") email = decoded.payload;
    }
    
    if (!email) {
      logger.warn("verifyAuth::invalid_token_payload", {
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        errorCode: "veri2",
      });
      return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({ status: "error", message: "Invalid token", errorCode: "veri2" });
    }
    
    (req as any).payload = { ...(req as any).payload, email: email };
    next();
  } catch (err: any) {
    logger.warn("verifyAuth::verify_failed", {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      errorCode: "veri3",
      message: err?.message ?? String(err),
    });
    return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({ status: "error", message: err?.message || String(err), errorCode: "veri3" });
  }
};

export { verifyAuth };
