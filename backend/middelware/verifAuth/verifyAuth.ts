// middleware/verifyAuth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../../function/createToken";

const verifyAuth = (req: Request, res: Response, next: NextFunction) => {
  const rawAuth = req.headers.authorization;
  const token = rawAuth?.split(" ")[1]?.trim();

  const looksMalformed =
    !token ||
    token === "undefined" ||
    token === "null" ||
    token.split(".").length !== 3;

  if (looksMalformed) {
    return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({ status: "error", message: "No token", errorCode: "veri1" });
  }

  try {
    const decoded: any = verifyAccessToken(token);
    let email: string | undefined;
    if (decoded && typeof decoded === "object") {
      if (typeof decoded.email === "string") email = decoded.email;
      else if (decoded.payload && typeof decoded.payload === "object") email = decoded.payload.email;
      else if (typeof decoded.payload === "string") email = decoded.payload;
    }
    
    if (!email) {
      return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({ status: "error", message: "Invalid token", errorCode: "veri2" });
    }
    
    console.log("email decoded dans verifiauth: ", email);
    
    (req as any).payload = { ...(req as any).payload, email: email };
    console.log("req payload  dans verifiauth: ", (req as any).payload);
    next();
  } catch (err: any) {
    return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({ status: "error", message: err?.message || String(err), errorCode: "veri3" });
  }
};

export { verifyAuth };
