import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import * as expressRateLimitModule from "express-rate-limit";
import type { Request } from "express";

type RateLimitModule = {
  ipKeyGenerator?: (ip: string) => string;
};

/**
 * `ipKeyGenerator` is available in the locked express-rate-limit version.
 * Reading it from the module namespace avoids preventing the server from
 * booting if an older deployment has not yet installed that version.
 */
function getIpRateLimitKey(ip: string): string {
  const ipKeyGenerator = (expressRateLimitModule as RateLimitModule)
    .ipKeyGenerator;

  if (typeof ipKeyGenerator === "function") {
    return ipKeyGenerator(ip);
  }

  // Compatibility fallback for legacy deployments. A fresh `npm ci` remains
  // required so IPv6 subnet masking from express-rate-limit is enabled.
  return ip.trim().toLowerCase() || "unknown-ip";
}

function normalizedEmailKey(req: Request): string {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const emailDigest = crypto.createHash("sha256").update(email).digest("hex");
  return `${getIpRateLimitKey(req.ip)}:${emailDigest}`;
}

/** Limit failed password guesses without retaining raw identifiers in memory. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: normalizedEmailKey,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).set("Cache-Control", "no-store").json({
      status: "error",
      message: "Too many login attempts. Please try again later.",
      code: "mw_loginRateLimiter_err1",
    });
  },
});
