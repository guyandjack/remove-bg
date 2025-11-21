// app.ts
/**
 * 🌐 Application Express principale
 * ----------------------------------
 * Ce fichier configure et exporte l’application Express.
 * Il initialise les middlewares essentiels (sécurité, logs, CORS, parsing, etc.)
 * et prépare les routes de ton backend.
 */
//import des librairies / package
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import compression from "compression";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";

// methode de journalsiation des evenements
import { logger, httpLoggerStream, requestIdMiddleware } from "./logger";

//import des types
import type { CorsOptions } from "cors";
import type { Request, Response, NextFunction } from "express";

//import des routes
import contactRoute from "./routes/contact.route";
import signupRoute from "./routes/signUp.route";
import loginRoute from "./routes/login.route";
import logOutRoute from "./routes/logOut.routes";
import verifyRoute from "./routes/verifyAuth.route";
import pexelsRoute from "./routes/pexels.route";
import stripeRoute from "./routes/stripe.route";
import forgotPasswordRoute from "./routes/forgotPassword.route";
import refreshRoute from "./routes/authRefresh.route";
import usageRoute from "./routes/usage.route";
import planOptionRoute from "./routes/planOption.route";

const app = express();

// ----------------------------------------------------
// 🔒 1️⃣ Sécurité et configuration HTTP
// ----------------------------------------------------

// Helmet ajoute divers en-têtes de sécurité HTTP (XSS, CSP, etc.)
app.use(helmet());

// Configuration CORS (autorisations de domaines front-end)
const corsOptions: CorsOptions = {
  origin(
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
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
app.use(compression());

// Gestion des cookies
app.use(cookieParser());

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
app.use(morgan(morganFormat, { stream: httpLoggerStream }));

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
//route authentification
app.use("/api/login", loginRoute);
app.use("/api/signup", signupRoute);
app.use("/api/logout", logOutRoute);
app.use("/api/auth/me", verifyRoute);
app.use("/api/auth/refresh", refreshRoute);
app.use("/api/forgot", forgotPasswordRoute);

//route pour formulaire de contact
app.use("/api/contact", contactRoute);

//route pour api pexels
app.use("/api/pexels", pexelsRoute);

//route pour api de paiement
app.use("/api/stripe", stripeRoute);

//route mise à jour user
app.use("/api/usage", usageRoute);

//route des options des plans
app.use("/api/plan/option", planOptionRoute);

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
