// app.js
/**
 * 🌐 Application Express principale
 * ----------------------------------
 * Ce fichier configure et exporte l’application Express.
 * Il initialise les middlewares essentiels (sécurité, logs, CORS, parsing, etc.)
 * et prépare les routes de ton backend.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
// path not used here
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
// fs not used here
import { logger, httpLoggerStream, requestIdMiddleware } from "./logger.ts";

import contactRoute from "./routes/contact.route.ts";
import signupRoute from "./routes/signUp.route.ts";
import loginRoute from "./routes/login.route.ts";
import verifyEmailRoute from "./routes/verifyEmail.route.ts";
import verifyEmailCodeRoute from "./routes/verifyEmail.route.ts";
//import verifyEmailCodeController from "./routes/verifyOpt.route.ts";

import type { Request, Response, NextFunction, RequestHandler } from "express";



const app = express();

// ----------------------------------------------------
// 🔒 1️⃣ Sécurité et configuration HTTP
// ----------------------------------------------------

// Helmet ajoute divers en-têtes de sécurité HTTP (XSS, CSP, etc.)
app.use(helmet());

// Configuration CORS (autorisations de domaines front-end)
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://bgremoved.ch", // domaine de production
      "http://localhost:5173", // front-end Vite dev
      "http://localhost:4173", // autre port Vite preview
    ];
    if (!origin) callback(null, true); // requêtes locales (ex: Postman)
    else if (allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("CORS error: origin not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
  ],
};
app.use(cors(corsOptions));

// ----------------------------------------------------
// ⚙️ 2️⃣ Middlewares généraux
// ----------------------------------------------------

// Parser JSON et URL-encoded (avec limite de taille)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Compression des réponses HTTP (gzip)
app.use(compression() as unknown as import("express").RequestHandler);

// Gestion des cookies
app.use(cookieParser() as unknown as import("express").RequestHandler);

// Gestion de l'upload de fichiers
app.use(fileUpload());

// Attribution d’un identifiant unique à chaque requête (utile pour le suivi des logs)
app.use(requestIdMiddleware);

// ----------------------------------------------------
// 🧠 3️⃣ Journalisation (logs HTTP + Winston)
// ----------------------------------------------------

// Format Morgan différent selon l'environnement
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";

// Redirection des logs HTTP de Morgan vers Winston (type-safe)
const httpLogMiddleware = morgan(morganFormat, {
  stream: httpLoggerStream,
}) as unknown as RequestHandler;
app.use(httpLogMiddleware);

// ----------------------------------------------------
// 🚦 4️⃣ Limitation du nombre de requêtes (anti-spam / brute-force)
// ----------------------------------------------------

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requêtes / IP
  message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use("/api/", limiter);

// ----------------------------------------------------
// 🧩 5️⃣ Routes principales
// ----------------------------------------------------

// Exemple de route de test
app.get("/test", (req, res) => {
  res.json({
    message: "✅ API online 🚀",
    requestId: (req as any).requestId,
  });
});

// Ici, tu pourras importer tes routes spécifiques :
 app.use("/api/login", loginRoute);
 app.use("/api/signup", signupRoute);
 app.use("/api/contact", contactRoute);
// app.use("/api/check/email", verifyEmailRoute);
// app.use("/api/check/otp", verifyEmailCodeRoute);
// etc.

// ----------------------------------------------------
// ⚠️ 6️⃣ Middleware de gestion d’erreurs global
// ----------------------------------------------------

// Doit être placé APRÈS toutes les routes
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`❌ Error: ${err.message}`, {
    requestId: (req as any).requestId,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(err.status || 500).json({
    error: true,
    message: err.message || "Internal Server Error",
    requestId: (req as any).requestId,
  });
});

// ----------------------------------------------------
// 🚀 7️⃣ Export de l’application Express
// ----------------------------------------------------

export default app;
