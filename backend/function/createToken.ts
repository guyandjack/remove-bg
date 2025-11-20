
import jwt, { type SignOptions, type Secret, type JwtPayload } from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRefreshTokenRecord, findValidRefreshTokenByJti } from "../DB/queriesSQL/queriesSQL.ts";
import { getUserByEmail } from "../DB/queriesSQL/queriesSQL.ts";

type Option = {
  domain?: string;
  httpOnly: boolean;
  secure: boolean;
  maxAge: number;
sameSite?: string;
}

export type PasswordResetPayload = {
  sub: string;
  email: string;
  typ: "password_reset";
  jti: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizePem(input: string): string {
  const maybe = input.includes("\\n") ? input.replace(/\\n/g, "\n") : input;
  return maybe.trim();
}

function tryRead(p?: string): string | null {
  if (!p) return null;
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function resolvePrivateKey(): string {
  const candidatePaths = [
    process.env.PRIVATE_KEY_PATH,
    path.resolve(__dirname, "..", "keys", "jwt_private_key.key"),
  ];
  for (const p of candidatePaths) {
    const content = tryRead(p);
    if (content && /BEGIN (RSA )?PRIVATE KEY/.test(content)) return content.trim();
  }
  const envKey = process.env.JWT_PRIVATE_KEY;
  if (envKey) {
    const k = normalizePem(envKey);
    if (/BEGIN (RSA )?PRIVATE KEY/.test(k)) return k;
  }
  throw new Error("RSA private key not found. Set PRIVATE_KEY_PATH or place keys/private.key");
}

function resolveAccessPublicKey(): string {
  const normalize = (v: string) => (v.includes("\\n") ? v.replace(/\\n/g, "\n") : v).trim();
  const candidatePaths = [
    process.env.JWT_PUBLIC_KEY_PATH,
    path.resolve(__dirname, "..", "keys", "jwt_public_key.key"),
  ];
  for (const p of candidatePaths) {
    const content = tryRead(p);
    if (content && /BEGIN (RSA )?PUBLIC KEY/.test(content)) return content.trim();
  }
  const envKey = process.env.JWT_PUBLIC_KEY;
  if (envKey) {
    const k = normalize(envKey);
    if (/BEGIN (RSA )?PUBLIC KEY/.test(k)) return k;
  }
  throw new Error("RSA public key (access) not found. Set JWT_PUBLIC_KEY_PATH or JWT_PUBLIC_KEY");
}

function resolveRefreshPublicKey(): string {
  const normalize = (v: string) => (v.includes("\\n") ? v.replace(/\\n/g, "\n") : v).trim();
  const candidatePaths = [
    process.env.JWT_REFRESH_PUBLIC_KEY_PATH,
    process.env.JWT_PUBLIC_KEY_PATH,
    path.resolve(__dirname, "..", "keys", "jwt_public_key.key"),
  ];
  for (const p of candidatePaths) {
    const content = tryRead(p);
    if (content && /BEGIN (RSA )?PUBLIC KEY/.test(content)) return content.trim();
  }
  const envKey = process.env.JWT_REFRESH_PUBLIC_KEY || process.env.JWT_PUBLIC_KEY;
  if (envKey) {
    const k = normalize(envKey);
    if (/BEGIN (RSA )?PUBLIC KEY/.test(k)) return k;
  }
  throw new Error("RSA public key (refresh) not found. Set JWT_REFRESH_PUBLIC_KEY_PATH or JWT_REFRESH_PUBLIC_KEY");
}

/**
 * Sign JWT access token
 * Accepts either a string email (legacy) or a password reset payload.
 */
const signAccessToken = (payload: string | PasswordResetPayload) => {
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
 * Sign JWT refreshToken
 */
const signRefreshToken = async (email: string, opts?: { ip?: string | null; userAgent?: string | null }) => {
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

/**
 * Verify JWT refresh token (RS256)
 */
const verifyRefreshToken = async (token: string) => {
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

export { signAccessToken, signRefreshToken, setCookieOptionsObject, verifyAccessToken, verifyRefreshToken };
