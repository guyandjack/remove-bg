// middleware/verifyAuth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const verifyAuth = (req: Request, res: Response, next: NextFunction)=> {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = req.cookies?.access_token ?? bearer; // ou req.cookies.session

  if (!token) {
    return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({ status:"error", message:"No token", errorCode:"veri1" });
  }

  try {
    const secretOrKey = process.env.PUBLIC_KEY_PATH;
    const payload = jwt.verify(token, secretOrKey as jwt.Secret, {
      algorithms: ["RS256"],
    }) as any;

    const user = {
      email: payload.email,
      authentified: true,
      credit: 5
    }
      
      return res.status(200).json({
        status: "success",
        user: user
      })
    }
   catch(err:any) {
    return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({
        status: "error",
        message: err || err.message,
        errorCode: "veri2"
      });
  }
}

export {verifyAuth}
