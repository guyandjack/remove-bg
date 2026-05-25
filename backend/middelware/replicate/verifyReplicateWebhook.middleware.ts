import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../../logger.js";

type VerifyReplicateWebhookOptions = {
  /**
   * Anti-replay window in seconds.
   * Replicate sends `webhook-timestamp` as seconds since epoch.
   */
  toleranceSeconds?: number;
};

function getHeader(req: Request, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ? String(value[0]) : null;
  if (typeof value === "string") return value;
  return value != null ? String(value) : null;
}

function parseTimestampSeconds(value: string): number | null {
  const trimmed = String(value || "").trim();
  if (!/^\d{1,15}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function extractBase64KeyFromSecret(secret: string): Buffer {
  const raw = String(secret || "").trim();
  if (!raw) {
    throw new Error("Missing REPLICATE_WEBHOOK_SECRET");
  }

  const withoutPrefix = raw.startsWith("whsec_") ? raw.slice("whsec_".length) : raw;
  const key = Buffer.from(withoutPrefix, "base64");
  if (!key.length) {
    throw new Error("Invalid REPLICATE_WEBHOOK_SECRET (base64 decode failed)");
  }
  return key;
}

function safeEqualBase64(expectedBase64: string, candidateBase64: string): boolean {
  try {
    const expected = Buffer.from(String(expectedBase64 || ""), "base64");
    const candidate = Buffer.from(String(candidateBase64 || ""), "base64");
    if (!expected.length || expected.length !== candidate.length) return false;
    return crypto.timingSafeEqual(expected, candidate);
  } catch {
    return false;
  }
}

function parseSignatureHeader(header: string): string[] {
  // Header is a space-delimited list: "v1,<sig> v1,<sig> v2,<sig>"
  const parts = String(header || "")
    .trim()
    .split(/\s+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const signatures: string[] = [];
  for (const part of parts) {
    const comma = part.indexOf(",");
    if (comma <= 0) continue;
    const version = part.slice(0, comma).trim();
    const sig = part.slice(comma + 1).trim();
    if (!sig) continue;
    // We only accept v1 for now (per Replicate docs examples).
    if (version === "v1") signatures.push(sig);
  }
  return signatures;
}

/**
 * Replicate webhook verifier.
 *
 * Requirements:
 * - Route must use raw body middleware so `req.body` is a Buffer (do not JSON-parse before verifying).
 * - Headers required: webhook-id, webhook-timestamp, webhook-signature
 * - Secret: REPLICATE_WEBHOOK_SECRET (format `whsec_<base64>`).
 */
export function verifyReplicateWebhook(
  options: VerifyReplicateWebhookOptions = {},
) {
  const toleranceSeconds =
    typeof options.toleranceSeconds === "number" && options.toleranceSeconds > 0
      ? options.toleranceSeconds
      : 5 * 60; // 5 minutes default

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const webhookId = getHeader(req, "webhook-id");
      const webhookTimestamp = getHeader(req, "webhook-timestamp");
      const webhookSignature = getHeader(req, "webhook-signature");

      if (!webhookId || !webhookTimestamp || !webhookSignature) {
        logger.warn("verifyReplicateWebhook::missing_headers", {
          code: "mw_verifyReplicateWebhook_err1",
          requestId: (req as any).requestId,
          hasId: Boolean(webhookId),
          hasTimestamp: Boolean(webhookTimestamp),
          hasSignature: Boolean(webhookSignature),
        });
        return res.status(401).send("Unauthorized");
      }

      // Raw body is mandatory (Buffer)
      const rawBody = (req as any).body;
      if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
        logger.warn("verifyReplicateWebhook::missing_raw_body", {
          code: "mw_verifyReplicateWebhook_err2",
          requestId: (req as any).requestId,
          webhookId,
        });
        return res.status(401).send("Unauthorized");
      }

      const timestampSeconds = parseTimestampSeconds(webhookTimestamp);
      if (!timestampSeconds) {
        logger.warn("verifyReplicateWebhook::invalid_timestamp", {
          code: "mw_verifyReplicateWebhook_err3",
          requestId: (req as any).requestId,
          webhookId,
          webhookTimestamp,
        });
        return res.status(401).send("Unauthorized");
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      const ageSeconds = Math.abs(nowSeconds - timestampSeconds);
      if (ageSeconds > toleranceSeconds) {
        logger.warn("verifyReplicateWebhook::timestamp_out_of_tolerance", {
          code: "mw_verifyReplicateWebhook_err4",
          requestId: (req as any).requestId,
          webhookId,
          ageSeconds,
          toleranceSeconds,
        });
        return res.status(401).send("Unauthorized");
      }

      const secret = process.env.REPLICATE_WEBHOOK_SECRET ?? "";
      let key: Buffer;
      try {
        key = extractBase64KeyFromSecret(secret);
      } catch (err: any) {
        logger.error("verifyReplicateWebhook::missing_or_invalid_secret", {
          code: "mw_verifyReplicateWebhook_err5",
          requestId: (req as any).requestId,
          webhookId,
          message: err?.message ?? String(err),
        });
        return res.status(401).send("Unauthorized");
      }

      const signedContent = `${webhookId}.${timestampSeconds}.${rawBody.toString("utf8")}`;
      const expectedSignature = crypto
        .createHmac("sha256", key)
        .update(signedContent, "utf8")
        .digest("base64");

      const candidates = parseSignatureHeader(webhookSignature);
      if (!candidates.length) {
        logger.warn("verifyReplicateWebhook::unsupported_signature_format", {
          code: "mw_verifyReplicateWebhook_err6",
          requestId: (req as any).requestId,
          webhookId,
        });
        return res.status(401).send("Unauthorized");
      }

      const ok = candidates.some((sig) => safeEqualBase64(expectedSignature, sig));
      if (!ok) {
        logger.warn("verifyReplicateWebhook::signature_mismatch", {
          code: "mw_verifyReplicateWebhook_err7",
          requestId: (req as any).requestId,
          webhookId,
        });
        return res.status(401).send("Unauthorized");
      }

      return next();
    } catch {
      logger.warn("verifyReplicateWebhook::unhandled_error", {
        code: "mw_verifyReplicateWebhook_err8",
        requestId: (req as any).requestId,
      });
      return res.status(401).send("Unauthorized");
    }
  };
}
