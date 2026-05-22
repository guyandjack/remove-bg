import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectDb } from "../poolConnexion/poolConnexion.js";

type DbExecute = <T>(
  sql: string,
  values?: any[],
) => Promise<[T, any]>;

type DbQueryable = {
  execute: DbExecute;
};

async function getDb(): Promise<DbQueryable> {
  return (await connectDb()) as unknown as DbQueryable;
}

/**
 * Best-effort cleanup. Safe to run periodically.
 * Never logs any identifier (email or HMAC) — only returns a count.
 */
export async function cleanupExpiredFreePlanEmailGuards(): Promise<number> {
  const db = await getDb();
  const [res] = await db.execute<ResultSetHeader>(
    `DELETE FROM \`free_plan_email_guard\` WHERE expires_at <= NOW()`,
  );
  return Number((res as any)?.affectedRows ?? 0);
}

export async function hasActiveFreePlanEmailGuard(emailHmac: string): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT 1
     FROM \`free_plan_email_guard\`
     WHERE email_hmac = ?
       AND expires_at > NOW()
     LIMIT 1`,
    [emailHmac],
  );
  return Boolean(rows[0]);
}

/**
 * Stores (or refreshes if expired) a guard row for 30 days.
 * If a non-expired row already exists, it is kept as-is (does not extend the window).
 */
export async function storeFreePlanEmailGuard(emailHmac: string): Promise<void> {
  const db = await getDb();
  await db.execute<ResultSetHeader>(
    `INSERT INTO \`free_plan_email_guard\` (email_hmac, created_at, expires_at)
     VALUES (?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
     ON DUPLICATE KEY UPDATE
       created_at = IF(expires_at <= NOW(), NOW(), created_at),
       expires_at = IF(expires_at <= NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), expires_at)`,
    [emailHmac],
  );
}
