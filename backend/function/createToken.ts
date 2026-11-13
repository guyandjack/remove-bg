import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "strict";
  path: string;
  maxAge?: number;
};

export type PasswordResetPayload = {
  sub: string;
  email: string;
  typ: "password_reset";
  jti: string;
};

export type SessionSubject = {
  userId: string;
  email: string;
};

export type RefreshTokenResult = {
  token: string;
  jti: string;
  expiresAt: Date;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_ISSUER = process.env.JWT_ISSUER || "wizpix-api";
const ACCESS_AUDIENCE = process.env.JWT_ACCESS_AUDIENCE || "wizpix-web";
const REFRESH_AUDIENCE = process.env.JWT_REFRESH_AUDIENCE || "wizpix-web";
const PASSWORD_RESET_AUDIENCE =
  process.env.JWT_PASSWORD_RESET_AUDIENCE || "wizpix-password-reset";

function parseExpiresInToMs(input: unknown, fallbackMs: number): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(0, Math.floor(input * 1000));
  }

  const raw = String(input ?? "").trim();
  if (!raw) return fallbackMs;
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds * 1000)) : fallbackMs;
  }

  const match = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
  if (!match) return fallbackMs;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(value)) return fallbackMs;

  const multiplier =
    unit === "ms"
      ? 1
      : unit === "s"
        ? 1000
        : unit === "m"
          ? 60 * 1000
          : unit === "h"
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;

  return Math.max(0, Math.floor(value * multiplier));
}

function normalizePem(input: string): string {
  const withRealNewlines = input.replace(/\r\n/g, "\n");
  return withRealNewlines.includes("\\n")
    ? withRealNewlines.replace(/\\n/g, "\n").trim()
    : withRealNewlines.trim();
}

function tryRead(filePath?: string): string | null {
  if (!filePath) return null;
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function resolvePemFromEnvOrPath(
  value: string | undefined,
  expectedHeader: RegExp,
  expectedFooter: RegExp,
): string | null {
  if (!value) return null;

  const normalized = normalizePem(value);
  if (expectedHeader.test(normalized) && expectedFooter.test(normalized)) return normalized;

  const fileContent = tryRead(value);
  if (!fileContent) return null;
  const fileNormalized = normalizePem(fileContent);
  return expectedHeader.test(fileNormalized) && expectedFooter.test(fileNormalized)
    ? fileNormalized
    : null;
}

function resolvePrivateKey(): string {
  const header = /BEGIN (RSA )?PRIVATE KEY/;
  const footer = /END (RSA )?PRIVATE KEY/;
  const envCandidates = [
    process.env.JWT_PRIVATE_KEY_PATH,
    process.env.PRIVATE_KEY_PATH,
    process.env.JWT_PRIVATE_KEY,
  ];

  for (const candidate of envCandidates) {
    const resolved = resolvePemFromEnvOrPath(candidate, header, footer);
    if (resolved) return resolved;
  }

  const fallback = tryRead(path.resolve(__dirname, "..", "keys", "jwt_private_key.key"));
  const resolvedFallback = fallback
    ? resolvePemFromEnvOrPath(fallback, header, footer)
    : null;
  if (resolvedFallback) return resolvedFallback;

  throw new Error("RSA private key not found. Set JWT_PRIVATE_KEY_PATH or JWT_PRIVATE_KEY.");
}

function resolveAccessPublicKey(): string {
  const header = /BEGIN (RSA )?PUBLIC KEY/;
  const footer = /END (RSA )?PUBLIC KEY/;
  const envCandidates = [process.env.JWT_PUBLIC_KEY_PATH, process.env.JWT_PUBLIC_KEY];

  for (const candidate of envCandidates) {
    const resolved = resolvePemFromEnvOrPath(candidate, header, footer);
    if (resolved) return resolved;
  }

  const fallback = tryRead(path.resolve(__dirname, "..", "keys", "jwt_public_key.key"));
  const resolvedFallback = fallback
    ? resolvePemFromEnvOrPath(fallback, header, footer)
    : null;
  if (resolvedFallback) return resolvedFallback;

  throw new Error("RSA public key not found. Set JWT_PUBLIC_KEY_PATH or JWT_PUBLIC_KEY.");
}

function resolveRefreshPublicKey(): string {
  const header = /BEGIN (RSA )?PUBLIC KEY/;
  const footer = /END (RSA )?PUBLIC KEY/;
  const envCandidates = [
    process.env.JWT_REFRESH_PUBLIC_KEY_PATH,
    process.env.JWT_PUBLIC_KEY_PATH,
    process.env.JWT_REFRESH_PUBLIC_KEY,
    process.env.JWT_PUBLIC_KEY,
  ];

  for (const candidate of envCandidates) {
    const resolved = resolvePemFromEnvOrPath(candidate, header, footer);
    if (resolved) return resolved;
  }

  const fallback = tryRead(path.resolve(__dirname, "..", "keys", "jwt_public_key.key"));
  const resolvedFallback = fallback
    ? resolvePemFromEnvOrPath(fallback, header, footer)
    : null;
  if (resolvedFallback) return resolvedFallback;

  throw new Error("RSA public key not found. Set JWT_REFRESH_PUBLIC_KEY_PATH or JWT_REFRESH_PUBLIC_KEY.");
}

function decodeRefreshMetadata(token: string): { jti: string; expiresAt: Date; issuedAt: Date } {
  const decoded = jwt.decode(token) as JwtPayload | null;
  const jti = typeof decoded?.jti === "string" ? decoded.jti : "";
  const exp = typeof decoded?.exp === "number" ? decoded.exp : undefined;
  const iat = typeof decoded?.iat === "number" ? decoded.iat : undefined;
  if (!jti || !exp) throw new Error("Unable to read generated refresh token metadata");

  return {
    jti,
    expiresAt: new Date(exp * 1000),
    issuedAt: iat ? new Date(iat * 1000) : new Date(),
  };
}

function buildRefreshToken(subject: SessionSubject): RefreshTokenResult {
  const privateKey = resolvePrivateKey();
  const token = jwt.sign(
    {
      sub: subject.userId,
      email: subject.email,
      typ: "refresh",
    },
    privateKey as unknown as Secret,
    {
      algorithm: "RS256",
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "1h") as SignOptions["expiresIn"],
      jwtid: crypto.randomUUID(),
      issuer: JWT_ISSUER,
      audience: REFRESH_AUDIENCE,
    },
  );
  const metadata = decodeRefreshMetadata(token);
  return { token, jti: metadata.jti, expiresAt: metadata.expiresAt };
}

/** Creates a short-lived access token bound to the refresh-token session. */
const signAccessToken = (subject: SessionSubject & { sessionId: string }) => {
  const privateKey = resolvePrivateKey();
  return jwt.sign(
    {
      sub: subject.userId,
      email: subject.email,
      sid: subject.sessionId,
      typ: "access",
    },
    privateKey as unknown as Secret,
    {
      algorithm: "RS256",
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as SignOptions["expiresIn"],
      issuer: JWT_ISSUER,
      audience: ACCESS_AUDIENCE,
    },
  );
};

const signPasswordResetToken = (payload: PasswordResetPayload) => {
  const privateKey = resolvePrivateKey();
  return jwt.sign(payload as JwtPayload, privateKey as unknown as Secret, {
    algorithm: "RS256",
    expiresIn: (process.env.JWT_PASSWORD_RESET_EXPIRES_IN || "15m") as SignOptions["expiresIn"],
    issuer: JWT_ISSUER,
    audience: PASSWORD_RESET_AUDIENCE,
  });
};

const signRefreshToken = async (
  subject: SessionSubject,
  opts?: { ip?: string | null; userAgent?: string | null },
): Promise<RefreshTokenResult> => {
  const { createRefreshTokenRecord, getUserByEmail } = await import("../DB/queriesSQL/queriesSQL.js");
  const user = await getUserByEmail(subject.email);
  if (!user || String(user.id) !== String(subject.userId)) {
    throw new Error("Cannot issue refresh token: user not found or mismatched");
  }

  const next = buildRefreshToken(subject);
  await createRefreshTokenRecord({
    jti: next.jti,
    userId: subject.userId,
    expiresAt: next.expiresAt,
    token: next.token,
    ip: opts?.ip ?? null,
    userAgent: opts?.userAgent ?? null,
  });
  return next;
};

/** Atomically consumes a refresh token and creates its replacement. */
const rotateRefreshToken = async (
  input: SessionSubject & {
    previousJti: string;
    ip?: string | null;
    userAgent?: string | null;
  },
): Promise<RefreshTokenResult> => {
  const { getUserByEmail, rotateRefreshTokenRecord } = await import("../DB/queriesSQL/queriesSQL.js");
  const user = await getUserByEmail(input.email);
  if (!user || String(user.id) !== String(input.userId)) {
    throw new Error("Cannot rotate refresh token: user not found or mismatched");
  }

  const next = buildRefreshToken(input);
  const consumed = await rotateRefreshTokenRecord({
    previousJti: input.previousJti,
    userId: input.userId,
    nextJti: next.jti,
    nextToken: next.token,
    issuedAt: new Date(),
    expiresAt: next.expiresAt,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
  if (!consumed) throw new Error("Refresh token already used, revoked, or expired");
  return next;
};

const verifyAccessToken = async (token: string) => {
  const { findValidRefreshTokenByJti } = await import("../DB/queriesSQL/queriesSQL.js");
  const decoded = jwt.verify(token, resolveAccessPublicKey(), {
    algorithms: ["RS256"],
    issuer: JWT_ISSUER,
    audience: ACCESS_AUDIENCE,
  }) as JwtPayload;
  const userId = typeof decoded.sub === "string" ? decoded.sub : "";
  const email = typeof decoded.email === "string" ? decoded.email : "";
  const sessionId = typeof decoded.sid === "string" ? decoded.sid : "";
  if (decoded.typ !== "access" || !userId || !email || !sessionId) {
    throw new Error("Invalid access token claims");
  }

  const session = await findValidRefreshTokenByJti(sessionId, userId);
  if (!session) throw new Error("Access token session revoked or expired");
  return { userId, email, sessionId };
};

const verifyPasswordResetToken = (token: string) => {
  const decoded = jwt.verify(token, resolveAccessPublicKey(), {
    algorithms: ["RS256"],
    issuer: JWT_ISSUER,
    audience: PASSWORD_RESET_AUDIENCE,
  }) as JwtPayload;
  if (decoded.typ !== "password_reset") throw new Error("Invalid password reset token claims");
  return decoded;
};

const verifyRefreshToken = async (token: string) => {
  const { findValidRefreshTokenByJti, sha256Buffer } = await import("../DB/queriesSQL/queriesSQL.js");
  const decoded = jwt.verify(token, resolveRefreshPublicKey(), {
    algorithms: ["RS256"],
    issuer: JWT_ISSUER,
    audience: REFRESH_AUDIENCE,
  }) as JwtPayload;
  const jti = typeof decoded.jti === "string" ? decoded.jti : "";
  const userId = typeof decoded.sub === "string" ? decoded.sub : "";
  const email = typeof decoded.email === "string" ? decoded.email : "";
  if (decoded.typ !== "refresh" || !jti || !userId || !email) {
    throw new Error("Invalid refresh token claims");
  }

  const record = await findValidRefreshTokenByJti(jti, userId);
  if (!record?.token_hash) throw new Error("Refresh token revoked or expired");
  const expectedHash = Buffer.from(record.token_hash);
  const actualHash = sha256Buffer(token);
  if (
    expectedHash.length !== actualHash.length ||
    !crypto.timingSafeEqual(expectedHash, actualHash)
  ) {
    throw new Error("Refresh token does not match its session record");
  }

  return { jti, userId, email };
};

function baseCookieOptions(): Omit<CookieOptions, "path" | "maxAge"> {
  const isLocalDevelopment = process.env.NODE_ENV === "development";
  return {
    httpOnly: true,
    // Any non-local environment must fail closed: cookies are never sent over HTTP.
    secure: !isLocalDevelopment,
    sameSite: isLocalDevelopment ? "lax" : "strict",
  };
}

const getAccessCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  path: "/api",
  maxAge: parseExpiresInToMs(process.env.JWT_ACCESS_EXPIRES_IN, 15 * 60 * 1000),
});

const getRefreshCookieOptions = (): CookieOptions => ({
  ...baseCookieOptions(),
  path: "/api/auth",
  maxAge: parseExpiresInToMs(process.env.JWT_REFRESH_EXPIRES_IN, 60 * 60 * 1000),
});

const getAccessCookieClearOptions = (): Omit<CookieOptions, "maxAge"> => ({
  ...baseCookieOptions(),
  path: "/api",
});

const getRefreshCookieClearOptions = (): Omit<CookieOptions, "maxAge"> => ({
  ...baseCookieOptions(),
  path: "/api/auth",
});

export {
  getAccessCookieClearOptions,
  getAccessCookieOptions,
  getRefreshCookieClearOptions,
  getRefreshCookieOptions,
  rotateRefreshToken,
  signAccessToken,
  signPasswordResetToken,
  signRefreshToken,
  verifyAccessToken,
  verifyPasswordResetToken,
  verifyRefreshToken,
};
