import type { RequestHandler } from "express";
import { resolveClientIp } from "../../utils/telegramNotification.ts";

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
    return res.status(429).json({
      status: "error",
      message:
        "Trop de requêtes sur le formulaire de contact. Réessayez dans quelques minutes.",
    });
  }

  entry.count += 1;
  rateStore.set(ip, entry);
  return next();
};

export { contactRateLimiter };
