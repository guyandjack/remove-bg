import crypto from "node:crypto";

/**
 * Email guard (free plan anti-abuse)
 * - Normalization: trim + lowercase
 * - Fingerprint: HMAC-SHA256(email_normalized, EMAIL_GUARD_SECRET) as hex
 *
 * IMPORTANT:
 * - Never log the raw email or the resulting HMAC.
 * - `EMAIL_GUARD_SECRET` is required (validated at server startup), but we keep a defensive runtime check too.
 */

export function normalizeEmailForGuard(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

export function computeEmailHmacSha256Hex(emailNormalized: string): string {
  const secret = String(process.env.EMAIL_GUARD_SECRET ?? "").trim();
  if (!secret) {
    throw new Error("Missing EMAIL_GUARD_SECRET env var.");
  }

  const normalized = normalizeEmailForGuard(emailNormalized);
  if (!normalized) {
    throw new Error("Invalid email for guard (empty after normalization).");
  }

  return crypto.createHmac("sha256", secret).update(normalized, "utf8").digest("hex");
}

