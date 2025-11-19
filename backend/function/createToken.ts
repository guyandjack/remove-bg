
import jwt from "jsonwebtoken";

type Option = {
  domain?: string;
  httpOnly: boolean;
  secure: boolean;
  maxAge: number;
sameSite?: string;
}

/**
 * Sign JWT accesstoken
 */
const signAccessToken = (email: string) => {
  let privateKey = process.env.JWT_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing JWT_PRIVATE_KEY");
  }

  return jwt.sign(
    { email },
    privateKey,
    {
      algorithm: "RS256",
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    }
  );
};

/**
 * Sign JWT refreshToken
 */
const signRefreshToken = (email: string) => {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing JWT_PRIVATE_KEY");
  }
  return jwt.sign({ email }, privateKey, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "1h",
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
