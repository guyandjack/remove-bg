import crypto from "node:crypto";
import type { Request } from "express";

function normalizeIp(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  // Express/Node can yield IPv6-mapped IPv4 like ::ffff:127.0.0.1
  if (value.startsWith("::ffff:")) return value.slice("::ffff:".length);
  return value;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    // First IP in the list is the original client.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  // Fallbacks
  const ipFromExpress = (req as any).ip as string | undefined;
  if (ipFromExpress) return normalizeIp(ipFromExpress);

  const socketIp = req.socket?.remoteAddress;
  if (socketIp) return normalizeIp(socketIp);

  return "";
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function getHashedVisitorIp(req: Request): {
  hashedIp: string;
  hashSuffix: string;
} {
  const salt = String(process.env.SECRET_SALT || "").trim();
  if (!salt) {
    throw new Error("Missing SECRET_SALT env var (required for visitor quotas).");
  }

  const ip = getClientIp(req);
  if (!ip) {
    throw new Error("Unable to resolve client IP for visitor quotas.");
  }

  const hashedIp = sha256Hex(`${ip}${salt}`);
  return { hashedIp, hashSuffix: hashedIp.slice(-8) };
}

