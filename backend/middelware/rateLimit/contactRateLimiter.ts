import type { RequestHandler } from "express";
import { resolveClientIp } from "../../utils/telegramNotification.js";
import { logger } from "../../logger.js";

type RateEntry = { count: number; expiresAt: number };

const WINDOW_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;
const rateStore = new Map<string, RateEntry>();

const contactRateLimiter: RequestHandler = (req, res, next) => {
  const ip = resolveClientIp(req);
  const now = Date.now();
  const entry = rateStore.get(ip);

  if (!entry || entry.expiresAt <= now) {
    rateStore.set(ip, { count: 1, expiresAt: now + WINDOW_DURATION_MS });
    return next();
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    logger.warn("contactRateLimiter::rate_limited", {
      code: "mw_contactRateLimiter_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      maxRequests: MAX_REQUESTS_PER_WINDOW,
      windowMs: WINDOW_DURATION_MS,
      currentCount: entry.count,
      expiresAt: entry.expiresAt,
    });
    return res.status(429).json({
      status: "error",
      message:
        "Trop de requêtes sur le formulaire de contact. Réessayez dans quelques minutes.",
      code: "mw_contactRateLimiter_err1",
    });
  }

  entry.count += 1;
  rateStore.set(ip, entry);
  return next();
};

export { contactRateLimiter };
