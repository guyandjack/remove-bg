
import jwt, { type SignOptions, type Secret, type JwtPayload } from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const signRefreshToken = (email: string) => {
  const privateKey = resolvePrivateKey();
  const key: Secret = privateKey as unknown as Secret;
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "1h") as SignOptions["expiresIn"],
    algorithm: "RS256" as SignOptions["algorithm"],
  };
  return jwt.sign({ email } as JwtPayload, key, options);
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

export { signAccessToken, signRefreshToken, setCookieOptionsObject };
