import dotenv from "dotenv";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";

type Payload = {
  email: string;
  firstname?: string;

}

type Option = {
  domain?: string;
  httpOnly: boolean;
  secure: boolean;
  maxAge: number;
sameSite?: string;
}

// Load environment from the backend/.env regardless of process cwd
(() => {
  try {
    // Resolve the absolute path to backend/.env relative to this file
    const here = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(here, "../.env");
    dotenv.config({ path: envPath });
  } catch {
    // Fallback to default lookup if resolution fails
    dotenv.config();
  }
})();

/**
 * Sign JWT accesstoken
 */
const signAccessToken = (payload : Payload) => {
  const envDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../");
  const keyPath = process.env.PRIVATE_KEY_PATH;
  if (!keyPath) throw new Error("PRIVATE_KEY_PATH is not defined");
  const resolvedKey = path.isAbsolute(keyPath) ? keyPath : path.resolve(envDir, keyPath);
  const privateKey = fs.readFileSync(resolvedKey, "utf8");
  return jwt.sign({ payload }, privateKey, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    algorithm: "RS256",
  });
};

/**
 * Sign JWT refreshToken
 */
const signRefreshToken = (id: string) => {
  const envDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../");
  const keyPath = process.env.PRIVATE_KEY_PATH;
  if (!keyPath) throw new Error("PRIVATE_KEY_PATH is not defined");
  const resolvedKey = path.isAbsolute(keyPath) ? keyPath : path.resolve(envDir, keyPath);
  const privateKey = fs.readFileSync(resolvedKey, "utf8");
  return jwt.sign({ id }, privateKey, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    algorithm: "RS256",
  });
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
