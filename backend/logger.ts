// logger.ts (ESM + TS)
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createLogger, format, transports, addColors } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import type { Request, Response, NextFunction } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vérifie que le dossier logs existe à la racine (backend/logs)
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const NODE_ENV = process.env.NODE_ENV || "development";
const LOG_LEVEL =
  process.env.LOG_LEVEL || (NODE_ENV === "production" ? "info" : "debug");

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

const colors = {
  error: "bold red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  verbose: "cyan",
  debug: "blue",
  silly: "grey",
};

addColors(colors);

const baseFormat = [
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.splat(),
];

const consoleFormat = format.combine(
  ...baseFormat,
  format.colorize({ all: true }),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const details = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    const line = stack ? `${message}\n${stack}` : message;
    return `${timestamp} [${level}] ${line}${details}`;
  })
);

const fileFormat = format.combine(...baseFormat, format.json());

// --- Transports (console + fichiers à la racine du projet)
const transportsList = [
  new transports.Console({
    level: LOG_LEVEL,
    format: consoleFormat,
  }),
  new DailyRotateFile({
    level: LOG_LEVEL,
    dirname: LOG_DIR,
    filename: "app-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    zippedArchive: true,
    format: fileFormat,
  }),
  new DailyRotateFile({
    level: "error",
    dirname: LOG_DIR,
    filename: "error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    maxFiles: "60d",
    zippedArchive: true,
    format: fileFormat,
  }),
];

function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const rid = req.headers["x-request-id"] || randomUUID();
  // @ts-expect-error augmented in types
  req.requestId = String(rid);
  res.setHeader("X-Request-Id", rid);
  next();
}


const logger = createLogger({
  level: LOG_LEVEL,
  levels,
  defaultMeta: { service: "api-server", env: NODE_ENV },
  transports: transportsList,
});

// Stream pour Morgan
const httpLoggerStream = { write: (message: string) => logger.http(message.trim()) };

export { logger, httpLoggerStream, requestIdMiddleware };
