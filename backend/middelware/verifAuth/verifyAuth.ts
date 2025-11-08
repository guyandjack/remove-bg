// middleware/verifyAuth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Payload = {
  email: string;
};

const verifyAuth = (req: Request, res: Response, next: NextFunction) => {
  // Récupération du token depuis l'en-tête Authorization
  const rawAuth = req.headers.authorization;
  const token = rawAuth?.split(" ")[1]?.trim();

  // Filtrer les valeurs invalides fréquentes ("undefined", "null" ou format non JWT)
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
    // Charger la clé publique depuis le chemin .env (contenu PEM requis pour RS256)
    // On remonte à la racine du backend (../../ depuis ce fichier)
    const envDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
    const keyPath = process.env.PUBLIC_KEY_PATH;
    if (!keyPath) throw new Error("PUBLIC_KEY_PATH is not defined");
    const resolvedKey = path.isAbsolute(keyPath) ? keyPath : path.resolve(envDir, keyPath);
    const publicKey = fs.readFileSync(resolvedKey, "utf8");

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    }) as any;

    // Supporter différents formats de payload selon la signature
    // - createToken.ts signe { payload: { email } }
    // - si appelé par erreur avec une string: { payload: "email" }
    // - fallback direct: { email }
    let email: string | undefined;
    if (decoded && typeof decoded === "object") {
      if (typeof decoded.payload === "string") {
        email = decoded.payload;
      } else if (decoded.payload && typeof decoded.payload === "object") {
        email = decoded.payload.email;
      } else if (typeof decoded.email === "string") {
        email = decoded.email;
      }
    }

    if (!email) {
      return res
        .status(401)
        .set("Cache-Control", "no-store")
        .json({ status: "error", message: "Invalid token payload", errorCode: "veri2" });
    }

    (req as any).payload = { email };
    next();
  } catch (err: any) {
    return res
      .status(401)
      .set("Cache-Control", "no-store")
      .json({
        status: "error",
        message: err || err.message,
        errorCode: "veri3",
      });
  }
};

export { verifyAuth };
