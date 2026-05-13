import fs from "node:fs/promises";
import path from "node:path";

import { logger } from "../../logger.js";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function pickWritablePublicDirCandidate(): string {
  const cwd = process.cwd();
  const distPublic = path.join(cwd, "dist", "public");
  const entry = String(process.argv?.[1] || "");
  const runsFromDist = entry.includes(`${path.sep}dist${path.sep}`);
  return runsFromDist ? distPublic : path.join(cwd, "public");
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function resolveRemoveBgDir(): Promise<string | null> {
  const publicDir = pickWritablePublicDirCandidate();
  const removebgDir = path.join(publicDir, "removebg");
  if (await dirExists(removebgDir)) return removebgDir;

  // Fallback: some environments may run from repo root while serving backend assets from backend/public.
  const alt = path.join(process.cwd(), "backend", "public", "removebg");
  if (await dirExists(alt)) return alt;

  // Another fallback: repo root + dist/public
  const altDist = path.join(process.cwd(), "backend", "dist", "public", "removebg");
  if (await dirExists(altDist)) return altDist;

  return null;
}

async function cleanupOnce(params: {
  dirPath: string;
  ttlMs: number;
  maxDeletesPerRun: number;
}): Promise<{ scanned: number; deleted: number }> {
  const now = Date.now();
  let scanned = 0;
  let deleted = 0;

  const entries = await fs.readdir(params.dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    scanned += 1;
    if (deleted >= params.maxDeletesPerRun) break;

    const filePath = path.join(params.dirPath, entry.name);
    try {
      const stat = await fs.stat(filePath);
      const ageMs = now - stat.mtimeMs;
      if (ageMs < params.ttlMs) continue;
      await fs.unlink(filePath);
      deleted += 1;
    } catch (err: any) {
      const code = String(err?.code || "");
      if (code === "ENOENT") continue;
      logger.warn("removeBgOutputCleanup::file_error", {
        file: entry.name,
        message: err?.message ?? String(err),
      });
    }
  }

  return { scanned, deleted };
}

/**
 * Periodic cleanup of generated remove-bg outputs stored in `public/removebg`.
 *
 * Why:
 * - We no longer delete outputs "one-shot" on download (client may need multiple fetches).
 * - We still want privacy + disk hygiene: keep files only for a short TTL.
 */
export async function startRemoveBgOutputCleanup(): Promise<() => void> {
  const enabled = String(process.env.REMOVEBG_OUTPUT_CLEANUP_ENABLED ?? "true")
    .trim()
    .toLowerCase() !== "false";
  if (!enabled) return () => {};

  const ttlSeconds = parsePositiveInt(process.env.REMOVEBG_OUTPUT_TTL_SECONDS, 120);
  const intervalSeconds = parsePositiveInt(
    process.env.REMOVEBG_OUTPUT_CLEANUP_INTERVAL_SECONDS,
    30,
  );
  const maxDeletesPerRun = parsePositiveInt(
    process.env.REMOVEBG_OUTPUT_CLEANUP_MAX_DELETE_PER_RUN,
    200,
  );

  const dirPath = await resolveRemoveBgDir();
  if (!dirPath) {
    logger.warn("removeBgOutputCleanup::dir_not_found", {
      ttlSeconds,
      intervalSeconds,
    });
    return () => {};
  }

  const ttlMs = ttlSeconds * 1000;
  const intervalMs = intervalSeconds * 1000;

  logger.info("removeBgOutputCleanup::started", {
    dirPath,
    ttlSeconds,
    intervalSeconds,
    maxDeletesPerRun,
  });

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    const startedAt = Date.now();
    try {
      const result = await cleanupOnce({ dirPath, ttlMs, maxDeletesPerRun });
      if (result.deleted > 0) {
        logger.info("removeBgOutputCleanup::deleted", {
          dirPath,
          scanned: result.scanned,
          deleted: result.deleted,
          durationMs: Date.now() - startedAt,
        });
      }
    } catch (err: any) {
      logger.warn("removeBgOutputCleanup::run_failed", {
        dirPath,
        message: err?.message ?? String(err),
      });
    } finally {
      running = false;
    }
  }, intervalMs);
  (timer as any).unref?.();

  return () => {
    try {
      clearInterval(timer);
      logger.info("removeBgOutputCleanup::stopped", { dirPath });
    } catch {}
  };
}

