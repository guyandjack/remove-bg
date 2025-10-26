// server.ts
/**
 * 🚀 Point d'entrée du serveur HTTP (Express + Winston)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import http from "node:http";
import app from "./app.ts";
import { logger } from "./logger.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

function normalizePort(val: string): number | string | false {
  const port = parseInt(val, 10);
  if (Number.isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

const HOST = process.env.HOST || "0.0.0.0";
const PORT = normalizePort(process.env.PORT || "3000");
if (!PORT) {
  logger.error("❌ Port invalide. Vérifie la variable d'environnement PORT.");
  process.exit(1);
}

app.set("port", PORT);

const server = http.createServer(app);
server.keepAliveTimeout = 75_000;
server.headersTimeout = 76_000;
server.requestTimeout = 0;

server.listen(PORT as number, HOST, () => {
  const hostForLog = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
  logger.info(`🚀 Server listening on http://${hostForLog}:${PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException & { syscall?: string }) => {
  if (error.syscall !== "listen") throw error;

  const bind = typeof PORT === "string" ? `pipe ${PORT}` : `port ${PORT}`;
  let message: string;

  switch (error.code) {
    case "EACCES":
      message = `${bind} requires elevated privileges.`;
      break;
    case "EADDRINUSE":
      message = `${bind} is already in use.`;
      break;
    default:
      throw error;
  }

  logger.error(`🛑 Server error: ${message}`);
  process.exit(1);
});

server.on("listening", () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr?.port}`;
  logger.info(`✅ Listening on ${bind}`);
});

server.on("clientError", (err, socket) => {
  logger.warn("⚠️ clientError", { message: (err as Error).message });
  try {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  } catch {}
});

function gracefulShutdown(code: number) {
  server.close((err?: Error) => {
    if (err) {
      logger.error("❌ Erreur lors de la fermeture du serveur", {
        message: err.message,
      });
      process.exit(1);
    }
    logger.info("👋 Serveur arrêté proprement. Bye!");
    process.exit(code);
  });

  setTimeout(() => {
    logger.warn("⏳ Arrêt forcé (timeout dépassé).");
    process.exit(code || 1);
  }, 10_000).unref();
}

process.on("unhandledRejection", (reason) => {
  logger.error("💥 Unhandled Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  gracefulShutdown(1);
});

process.on("uncaughtException", (err: Error) => {
  logger.error(`🔥 Uncaught Exception: ${err.message}`, { stack: err.stack });
  gracefulShutdown(1);
});

process.on("SIGINT", () => {
  logger.info("🧹 SIGINT reçu. Arrêt en cours…");
  gracefulShutdown(0);
});

process.on("SIGTERM", () => {
  logger.info("🧹 SIGTERM reçu. Arrêt en cours…");
  gracefulShutdown(0);
});

