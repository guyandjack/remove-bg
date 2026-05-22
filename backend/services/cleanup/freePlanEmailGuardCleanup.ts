import { logger } from "../../logger.js";
import { cleanupExpiredFreePlanEmailGuards } from "../../DB/queriesSQL/freePlanEmailGuard.queries.js";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Periodic DB cleanup for `free_plan_email_guard`:
 * - Deletes expired rows (expires_at <= NOW()).
 * - Never logs any identifier (email or HMAC).
 */
export async function startFreePlanEmailGuardCleanup(): Promise<() => void> {
  const enabled =
    String(process.env.EMAIL_GUARD_CLEANUP_ENABLED ?? "true").trim().toLowerCase() !==
    "false";
  if (!enabled) return () => {};

  const intervalSeconds = parsePositiveInt(
    process.env.EMAIL_GUARD_CLEANUP_INTERVAL_SECONDS,
    6 * 60 * 60, // 6h
  );

  logger.info("freePlanEmailGuardCleanup::started", { intervalSeconds });

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    const startedAt = Date.now();
    try {
      const deleted = await cleanupExpiredFreePlanEmailGuards();
      if (deleted > 0) {
        logger.info("freePlanEmailGuardCleanup::deleted", {
          deleted,
          durationMs: Date.now() - startedAt,
        });
      }
    } catch (err: any) {
      logger.warn("freePlanEmailGuardCleanup::run_failed", {
        message: err?.message ?? String(err),
      });
    } finally {
      running = false;
    }
  }, intervalSeconds * 1000);
  (timer as any).unref?.();

  // Run once at startup (best-effort)
  try {
    const deleted = await cleanupExpiredFreePlanEmailGuards();
    if (deleted > 0) {
      logger.info("freePlanEmailGuardCleanup::deleted", { deleted, durationMs: 0 });
    }
  } catch (err: any) {
    logger.warn("freePlanEmailGuardCleanup::startup_failed", {
      message: err?.message ?? String(err),
    });
  }

  return () => {
    try {
      clearInterval(timer);
      logger.info("freePlanEmailGuardCleanup::stopped");
    } catch {}
  };
}

