import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import crypto from "node:crypto";

import { optimizeTransparentRaster } from "./optimizeTransparentRaster.js";

function safeFilenameBase(input: string): string {
  const value = String(input || "").trim();
  // Keep it predictable (request_id is already limited to 64 chars in DB helpers).
  const cleaned = value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-{2,}/g, "-");
  return cleaned.replace(/^-+|-+$/g, "").toLowerCase() || "removebg";
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function atomicWriteFile(params: { filePath: string; data: Buffer }): Promise<void> {
  const dir = path.dirname(params.filePath);
  await ensureDir(dir);
  const tmpPath = `${params.filePath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tmpPath, params.data);
  await fs.rename(tmpPath, params.filePath);
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function pickWritablePublicDir(): Promise<string> {
  // Runtime nuance:
  // - dev (tsx): static dir is typically `<backend>/public`
  // - prod (node dist): static dir is typically `<backend>/dist/public`
  // We support both by detecting whether the current entrypoint runs from `dist/`.
  const cwd = process.cwd();
  const distPublic = path.join(cwd, "dist", "public");
  const entry = String(process.argv?.[1] || "");
  const runsFromDist = entry.includes(`${path.sep}dist${path.sep}`);
  if (runsFromDist && (await dirExists(distPublic))) return distPublic;
  return path.join(cwd, "public");
}

export async function resolveStoredRemoveBgOutputPath(params: {
  requestId: string;
  token: string;
  extension?: string;
}): Promise<{ dirPath: string; filePath: string; filename: string }> {
  const requestId = String(params.requestId || "").trim();
  const token = String(params.token || "").trim();
  const ext = String(params.extension || "png").trim().toLowerCase() || "png";
  if (!requestId) throw new Error("resolveStoredRemoveBgOutputPath: requestId is required");
  if (!token) throw new Error("resolveStoredRemoveBgOutputPath: token is required");
  const publicDir = await pickWritablePublicDir();
  const dirPath = path.join(publicDir, "removebg");
  const base = safeFilenameBase(requestId);
  const safeToken = token.replace(/[^a-z0-9]+/gi, "");
  const filename = `${base}.${safeToken}.${ext}`;
  const filePath = path.join(dirPath, filename);
  return { dirPath, filePath, filename };
}

export async function storeOptimizedRemoveBgOutput(params: {
  requestId: string;
  sourceUrl: string;
  publicBaseUrl: string;
  outputEndpointPath?: string;
  timeoutMs?: number;
}): Promise<{
  publicUrl: string;
  bytesRaw: number;
  bytesOptimized: number;
  filePath: string;
  token: string;
  timingsMs: {
    download: number;
    optimize: number;
    write: number;
    total: number;
  };
}> {
  const requestId = String(params.requestId || "").trim();
  const sourceUrl = String(params.sourceUrl || "").trim();
  const publicBaseUrl = String(params.publicBaseUrl || "").replace(/\/+$/, "");
  if (!requestId) throw new Error("storeOptimizedRemoveBgOutput: requestId is required");
  if (!sourceUrl) throw new Error("storeOptimizedRemoveBgOutput: sourceUrl is required");
  if (!publicBaseUrl) throw new Error("storeOptimizedRemoveBgOutput: publicBaseUrl is required");

  const timeoutMs =
    typeof params.timeoutMs === "number" && params.timeoutMs > 0
      ? params.timeoutMs
      : 120_000;

  const startedAtMs = Date.now();
  const downloadStartedAtMs = Date.now();
  const resp = await axios.get<ArrayBuffer>(sourceUrl, {
    responseType: "arraybuffer",
    timeout: timeoutMs,
    // Some signed URLs may redirect; axios follows redirects by default.
  });
  const downloadMs = Date.now() - downloadStartedAtMs;

  const rawBuffer = Buffer.from(resp.data);
  const rawContentType = String(resp.headers?.["content-type"] || "image/png");

  const optimizeStartedAtMs = Date.now();
  const optimized = await optimizeTransparentRaster({
    input: rawBuffer,
    inputContentType: rawContentType,
  });
  const optimizeMs = Date.now() - optimizeStartedAtMs;

  const token = crypto.randomBytes(16).toString("hex");
  const { filePath, filename } = await resolveStoredRemoveBgOutputPath({
    requestId,
    token,
    extension: optimized.extension,
  });

  const writeStartedAtMs = Date.now();
  await atomicWriteFile({ filePath, data: optimized.buffer });
  const writeMs = Date.now() - writeStartedAtMs;
  const totalMs = Date.now() - startedAtMs;

  const outputEndpointPath =
    String(params.outputEndpointPath || "").trim() ||
    `/api/services/remove-bg-replicate/jobs/${encodeURIComponent(requestId)}/output`;

  // Serve through one-shot endpoint that deletes the file after delivery.
  // Note: outputEndpointPath must not include a querystring; we append token ourselves.
  const publicUrl = `${publicBaseUrl}${outputEndpointPath}?token=${encodeURIComponent(token)}`;

  return {
    publicUrl,
    bytesRaw: rawBuffer.length,
    bytesOptimized: optimized.buffer.length,
    filePath,
    token,
    timingsMs: {
      download: downloadMs,
      optimize: optimizeMs,
      write: writeMs,
      total: totalMs,
    },
  };
}
