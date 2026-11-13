import type { NextFunction, Request, Response } from "express";
import { isTrustedOrigin } from "../../config/security.js";
import { logger } from "../../logger.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isVerifiedWebhook(req: Request): boolean {
  const requestPath = (req.originalUrl || req.url).split("?")[0];
  return (
    requestPath === "/api/stripe/webhook" ||
    requestPath === "/api/replicate/webhook"
  );
}

/**
 * Cookie-authenticated browser requests must originate from a configured UI.
 * CORS alone does not stop cross-site requests that change server state.
 */
export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || isVerifiedWebhook(req)) return next();

  const origin = req.get("origin");
  if (origin && isTrustedOrigin(origin)) return next();

  // Local CLI and integration tools do not necessarily attach Origin. Production
  // is deliberately fail-closed; non-browser production clients need an explicit
  // authenticated integration endpoint rather than bypassing this middleware.
  if (!origin && process.env.NODE_ENV !== "production") return next();

  logger.warn("csrf::untrusted_origin", {
    code: "mw_csrf_err1",
    requestId: (req as any).requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    hasOrigin: Boolean(origin),
  });
  return res.status(403).set("Cache-Control", "no-store").json({
    status: "error",
    message: "Forbidden",
    code: "mw_csrf_err1",
  });
}
