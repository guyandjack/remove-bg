// server.js
/**
 * 🚀 Point d'entrée du serveur HTTP (Express + Winston)
 * -----------------------------------------------------
 * - Charge les variables d'environnement
 * - Démarre le serveur HTTP sur le port souhaité
 * - Journalise les événements importants (écoute, erreurs)
 * - Gère proprement les erreurs non interceptées et l'arrêt (SIGINT/SIGTERM)
 */

// -----------------------------------------------------------------------------
// 1) Configuration d'environnement (doit être chargée AVANT le reste)
// -----------------------------------------------------------------------------
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

// -----------------------------------------------------------------------------
// 2) Imports applicatifs et cœur Node
// -----------------------------------------------------------------------------
import http from "node:http";
import app from "./app.js"; // Instance Express déjà configurée
import { logger } from "./logger.js"

// -----------------------------------------------------------------------------
// 3) Normalisation du port & lecture des variables
// -----------------------------------------------------------------------------
/**
 * Convertit une valeur de port en nombre, nom de pipe, ou false.
 */
function normalizePort(val) {
  const port = parseInt(val, 10);
  if (Number.isNaN(port)) return val; // named pipe (ex: "\\.\pipe\myapp")
  if (port >= 0) return port; // port number
  return false;
}

const HOST = process.env.HOST || "0.0.0.0";
const PORT = normalizePort(process.env.PORT || "3000");
if (!PORT) {
  logger.error("❌ Port invalide. Vérifie la variable d'environnement PORT.");
  process.exit(1);
}

// Express garde cette info dans ses settings (facultatif mais pratique)
app.set("port", PORT);

// -----------------------------------------------------------------------------
// 4) Création du serveur HTTP et options réseau
// -----------------------------------------------------------------------------
const server = http.createServer(app);

// (Optionnel mais recommandé en prod)
// Évite certains timeouts par défaut trop courts/longs et les sockets zombies.
server.keepAliveTimeout = 75_000; // 75s (ALB/NGINX courants)
server.headersTimeout = 76_000; // > keepAliveTimeout
server.requestTimeout = 0; // pas de timeout global de requête ici

// -----------------------------------------------------------------------------
// 5) Démarrage & journaux de démarrage
// -----------------------------------------------------------------------------
server.listen(PORT, HOST, () => {
  // Essayons d'afficher une URL lisible (localhost si possible)
  const hostForLog = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
  logger.info(`🚀 Server listening on http://${hostForLog}:${PORT}`);
});

// -----------------------------------------------------------------------------
// 6) Gestion des erreurs serveur (bind/permissions/port occupé, etc.)
// -----------------------------------------------------------------------------
server.on("error", (error) => {
  if (error.syscall !== "listen") throw error;

  const bind = typeof PORT === "string" ? `pipe ${PORT}` : `port ${PORT}`;
  let message;

  switch (error.code) {
    case "EACCES":
      message = `${bind} requires elevated privileges.`;
      break;
    case "EADDRINUSE":
      message = `${bind} is already in use.`;
      break;
    default:
      throw error; // laisser remonter les erreurs inconnues
  }

  logger.error(`🛑 Server error: ${message}`);
  process.exit(1);
});

// Log d’état quand l’OS confirme l’écoute (utile si pas de callback dans listen)
server.on("listening", () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
  logger.info(`✅ Listening on ${bind}`);
});

// (Optionnel) Log des erreurs côté socket client (évite crash pour requêtes malformées)
server.on("clientError", (err, socket) => {
  logger.warn("⚠️ clientError", { message: err.message });
  try {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  } catch (_) {}
});

// -----------------------------------------------------------------------------
// 7) Gestion des erreurs globales du process
// -----------------------------------------------------------------------------
process.on("unhandledRejection", (reason, promise) => {
  logger.error("💥 Unhandled Rejection", {
    reason: reason instanceof Error ? reason.message : reason,
  });
  gracefulShutdown(1);
});

process.on("uncaughtException", (err) => {
  logger.error(`🔥 Uncaught Exception: ${err.message}`, { stack: err.stack });
  gracefulShutdown(1);
});

// -----------------------------------------------------------------------------
// 8) Arrêt propre (SIGINT/SIGTERM) pour containers/PM2/systemd
// -----------------------------------------------------------------------------
process.on("SIGINT", () => {
  logger.info("🧹 SIGINT reçu. Arrêt en cours…");
  gracefulShutdown(0);
});

process.on("SIGTERM", () => {
  logger.info("🧹 SIGTERM reçu. Arrêt en cours…");
  gracefulShutdown(0);
});

/**
 * Ferme le serveur proprement puis quitte le process.
 * @param {number} code Code de sortie du process (0 = normal, 1 = erreur)
 */
function gracefulShutdown(code) {
  // Empêche de nouvelles connexions et attend la fin des requêtes en cours
  server.close((err) => {
    if (err) {
      logger.error("❌ Erreur lors de la fermeture du serveur", {
        message: err.message,
      });
      process.exit(1);
    }
    logger.info("👋 Serveur arrêté proprement. Bye!");
    process.exit(code);
  });

  // Sécurité: si quelque chose bloque, on force l'arrêt après délai
  setTimeout(() => {
    logger.warn("⏳ Arrêt forcé (timeout dépassé).");
    process.exit(code || 1);
  }, 10_000).unref();
}
