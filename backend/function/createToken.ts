
import jwt, { type SignOptions, type Secret, type JwtPayload } from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// IMPORTANT: do not import DB modules at top-level.
// This file is used in contexts (tests, tooling) where DB modules may not be resolvable.
// DB queries are imported lazily inside the few functions that need them (refresh tokens).

type Option = {
  domain?: string;
  httpOnly: boolean;
  secure: boolean;
  maxAge: number;
  sameSite?: string;
};

export type PasswordResetPayload = {
  sub: string;
  email: string;
  typ: "password_reset";
  jti: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizePem(input: string): string {
  const withRealNewlines = input.replace(/\r\n/g, "\n");
  const withEscapedNewlines = withRealNewlines.includes("\\n")
    ? withRealNewlines.replace(/\\n/g, "\n")
    : withRealNewlines;
  return withEscapedNewlines.trim();
}

function tryRead(p?: string): string | null {
  if (!p) return null;
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function resolvePemFromEnvOrPath(
  value: string | undefined,
  expectedHeader: RegExp,
  expectedFooter: RegExp
): string | null {
  if (!value) return null;

  // If the env var now directly contains the PEM (your new setup), use it as-is.
  const normalized = normalizePem(value);
  if (expectedHeader.test(normalized) && expectedFooter.test(normalized)) return normalized;

  // Backward-compat: if the env var used to be a path, try to read it.
  const fileContent = tryRead(value);
  if (!fileContent) return null;
  const fileNormalized = normalizePem(fileContent);
  if (expectedHeader.test(fileNormalized) && expectedFooter.test(fileNormalized)) return fileNormalized;

  return null;
}

function resolvePrivateKey(): string {
  const header = /BEGIN (RSA )?PRIVATE KEY/;
  const footer = /END (RSA )?PRIVATE KEY/;

  // Support both old and new meanings:
  // - Previously: *_PATH = file path to a .key
  // - Now:       *_PATH = actual PEM content inside .env
  const envCandidates = [
    process.env.JWT_PRIVATE_KEY_PATH,
    process.env.PRIVATE_KEY_PATH,
    process.env.JWT_PRIVATE_KEY,
  ];
  for (const v of envCandidates) {
    const resolved = resolvePemFromEnvOrPath(v, header, footer);
    if (resolved) return resolved;
  }

  const fallbackPath = path.resolve(__dirname, "..", "keys", "jwt_private_key.key");
  const fallback = tryRead(fallbackPath);
  if (fallback) {
    const resolved = resolvePemFromEnvOrPath(fallback, header, footer);
    if (resolved) return resolved;
  }

  throw new Error(
    "RSA private key not found. Set JWT_PRIVATE_KEY_PATH (recommended) or JWT_PRIVATE_KEY. Backward-compat: PRIVATE_KEY_PATH can be a path."
  );
}

function resolveAccessPublicKey(): string {
  const header = /BEGIN (RSA )?PUBLIC KEY/;
  const footer = /END (RSA )?PUBLIC KEY/;

  const envCandidates = [process.env.JWT_PUBLIC_KEY_PATH, process.env.JWT_PUBLIC_KEY];
  for (const v of envCandidates) {
    const resolved = resolvePemFromEnvOrPath(v, header, footer);
    if (resolved) return resolved;
  }

  const fallbackPath = path.resolve(__dirname, "..", "keys", "jwt_public_key.key");
  const fallback = tryRead(fallbackPath);
  if (fallback) {
    const resolved = resolvePemFromEnvOrPath(fallback, header, footer);
    if (resolved) return resolved;
  }

  throw new Error("RSA public key (access) not found. Set JWT_PUBLIC_KEY_PATH (recommended) or JWT_PUBLIC_KEY");
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
  for (const v of envCandidates) {
    const resolved = resolvePemFromEnvOrPath(v, header, footer);
    if (resolved) return resolved;
  }

  const fallbackPath = path.resolve(__dirname, "..", "keys", "jwt_public_key.key");
  const fallback = tryRead(fallbackPath);
  if (fallback) {
    const resolved = resolvePemFromEnvOrPath(fallback, header, footer);
    if (resolved) return resolved;
  }

  throw new Error(
    "RSA public key (refresh) not found. Set JWT_REFRESH_PUBLIC_KEY_PATH (recommended) or JWT_REFRESH_PUBLIC_KEY"
  );
}

/**
 * Sign JWT access token
 * Accepts either a string email (legacy) or a structured payload.
 */
const signAccessToken = (payload: string | JwtPayload) => {
  const privateKey = resolvePrivateKey();

  const body: JwtPayload | string =
    typeof payload === "string" ? { email: payload } : (payload as JwtPayload);

  const key: Secret = privateKey as unknown as Secret;
  const options: SignOptions = {
    algorithm: "RS256" as SignOptions["algorithm"],
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as SignOptions["expiresIn"],
  };

  return jwt.sign(body, key, options);
};

/**
 * Password reset tokens must not be tied to short-lived access tokens.
 */
const signPasswordResetToken = (payload: PasswordResetPayload) => {
  const privateKey = resolvePrivateKey();
  const key: Secret = privateKey as unknown as Secret;
  const options: SignOptions = {
    algorithm: "RS256" as SignOptions["algorithm"],
    expiresIn: (process.env.JWT_PASSWORD_RESET_EXPIRES_IN || "15m") as SignOptions["expiresIn"],
  };
  return jwt.sign(payload as unknown as JwtPayload, key, options);
};

/**
 * Sign JWT refreshToken
 */
const signRefreshToken = async (email: string, opts?: { ip?: string | null; userAgent?: string | null }) => {
  const { createRefreshTokenRecord, getUserByEmail } = await import("../DB/queriesSQL/queriesSQL.js");
  const privateKey = resolvePrivateKey();
  const key: Secret = privateKey as unknown as Secret;
  const jti = crypto.randomUUID();
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error("Cannot issue refresh token: user not found for email");
  }
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "1h") as SignOptions["expiresIn"],
    algorithm: "RS256" as SignOptions["algorithm"],
    jwtid: jti,
  };
  // Do NOT duplicate jti in payload when using options.jwtid
  const payload: JwtPayload = { email, userId: user.id } as any;
  const token = jwt.sign(payload, key, options);
  // Decode to get exp/iat for DB persistence
  const decoded = jwt.decode(token) as JwtPayload | null;
  const exp = decoded && typeof decoded === "object" ? decoded.exp : undefined;
  const iat = decoded && typeof decoded === "object" ? decoded.iat : undefined;
  const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + 60 * 60 * 1000);
  const issuedAt = iat ? new Date(iat * 1000) : new Date();
  await createRefreshTokenRecord({
    jti,
    userId: user.id,
    expiresAt,
    token,
    ip: opts?.ip ?? null,
    userAgent: opts?.userAgent ?? null,
    issuedAt,
  });
  return token;
};


/**
 * Verify JWT access token (RS256)
 */
const verifyAccessToken = (token: string) => {
  const publicKey = resolveAccessPublicKey();
  const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
  return decoded as JwtPayload | string;
};

const verifyPasswordResetToken = (token: string) => {
  return verifyAccessToken(token) as JwtPayload | string;
};


/**
 * Verify JWT refresh token (RS256)
 */
const verifyRefreshToken = async (token: string) => {
  const { findValidRefreshTokenByJti } = await import("../DB/queriesSQL/queriesSQL.js");
  const publicKey = resolveRefreshPublicKey();
  const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as any;
  const jti: string | undefined = decoded?.jti || decoded?.jwtid;
  const userId: string | undefined = decoded?.userId;
  if (!jti) throw new Error("Invalid refresh token: missing jti");
  const rec = await findValidRefreshTokenByJti(jti, userId);
  if (!rec) throw new Error("Refresh token revoked or expired");
  return decoded as JwtPayload | string;
};


//fonction pour définir les options de cookie
const setCookieOptionsObject = () => {
    const mode = process.env.NODE_ENV
  switch (mode) {
    case "production":
      return {
        domain: "background.ch",
        httpOnly: true,
        secure: true,
        maxAge: 15 * 60 * 1000,
        sameSite: "none",
      } as Option;

    case "development":
      return {
        //domain: "undefined",
        httpOnly: true,
        secure: false,
        maxAge: 60 * 60 * 1000,
        //samesite: "none",
      } as Option;

    default:
      return {};
  }
};

export { signAccessToken, signPasswordResetToken, signRefreshToken, setCookieOptionsObject, verifyAccessToken, verifyPasswordResetToken, verifyRefreshToken };
