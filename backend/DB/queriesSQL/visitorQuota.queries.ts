import type { FieldPacket, QueryOptions, RowDataPacket } from "mysql2/promise";
import { connectDb } from "../poolConnexion/poolConnexion.js";
import { planOption } from "../../data/planOption.js";

type DbExecute = <T>(
  sql: string | QueryOptions,
  values?: any,
) => Promise<[T, FieldPacket[]]>;

type DbQueryable = { execute: DbExecute; query: DbExecute };

async function getDb(): Promise<DbQueryable> {
  return (await connectDb()) as unknown as DbQueryable;
}

export type VisitorQuotaSnapshot = {
  removeBgUsed: number;
  imageConvertMonth: string | null;
  imageConvertUsed: number;
};

type VisitorQuotaRow = RowDataPacket & {
  hashed_ip: string;
  remove_bg_used: number;
  image_convert_month: string | null;
  image_convert_used: number;
};

const DEFAULT_MONTH = "1970-01";

function monthKeyUTC(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function parseMonthlyLimitFromPlanOption(params: {
  planCode: string;
  service: "remove_bg" | "image_convert";
}): number | null {
  const code = String(params.planCode || "").trim().toLowerCase();
  const cfg = planOption.find((p) => String(p.name || "").toLowerCase() === code);
  if (!cfg) return null;

  if (params.service === "remove_bg") {
    const limit = Number((cfg as any).credit_IA);
    return Number.isFinite(limit) && limit >= 0 ? limit : null;
  }

  const raw = String((cfg as any).credit_conversion ?? "").trim();
  const normalized = raw.toLowerCase();
  if (
    ["infiny", "infinity", "infinite", "illimite", "illimité", "unlimited"].includes(
      normalized,
    )
  ) {
    return Number.MAX_SAFE_INTEGER;
  }
  const limit = Number(raw);
  return Number.isFinite(limit) && limit >= 0 ? limit : null;
}

export async function getVisitorQuotaSnapshot(
  hashedIp: string,
): Promise<VisitorQuotaSnapshot> {
  const db = await getDb();
  const [rows] = await db.execute<VisitorQuotaRow[]>(
    `SELECT hashed_ip, remove_bg_used, image_convert_month, image_convert_used
     FROM VisitorQuota
     WHERE hashed_ip = ?
     LIMIT 1`,
    [hashedIp],
  );
  const row = rows[0];
  if (!row) {
    return {
      removeBgUsed: 0,
      imageConvertMonth: null,
      imageConvertUsed: 0,
    };
  }
  return {
    removeBgUsed: Number(row.remove_bg_used) || 0,
    imageConvertMonth: row.image_convert_month ? String(row.image_convert_month) : null,
    imageConvertUsed: Number(row.image_convert_used) || 0,
  };
}

export async function ensureVisitorQuotaRow(
  hashedIp: string,
): Promise<void> {
  const db = await getDb();
  const currentMonth = monthKeyUTC();
  await db.execute(
    `INSERT INTO VisitorQuota (hashed_ip, remove_bg_used, image_convert_month, image_convert_used)
     VALUES (?, 0, ?, 0)
     ON DUPLICATE KEY UPDATE
       remove_bg_used = IF(image_convert_month = VALUES(image_convert_month), remove_bg_used, 0),
       image_convert_used = IF(image_convert_month = VALUES(image_convert_month), image_convert_used, 0),
       image_convert_month = VALUES(image_convert_month)`,
    [hashedIp, currentMonth],
  );
}

export async function tryConsumeRemoveBgTrial(
  hashedIp: string,
  planCode: string = "visitor",
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const db = await getDb();
  await ensureVisitorQuotaRow(hashedIp);

  const limit =
    parseMonthlyLimitFromPlanOption({ planCode, service: "remove_bg" }) ?? 1;
  const [beforeRows] = await db.execute<VisitorQuotaRow[]>(
    `SELECT remove_bg_used, image_convert_month, image_convert_used
     FROM VisitorQuota
     WHERE hashed_ip = ?
     LIMIT 1`,
    [hashedIp],
  );
  const before = beforeRows[0];
  const usedBefore = Number(before?.remove_bg_used) || 0;
  if (limit >= Number.MAX_SAFE_INTEGER) {
    // Unlimited: do not increment, just allow.
    return { allowed: true, used: usedBefore, limit };
  }
  if (usedBefore >= limit) {
    return { allowed: false, used: usedBefore, limit };
  }

  const [result] = await db.execute<any>(
    `UPDATE VisitorQuota
     SET remove_bg_used = remove_bg_used + 1
     WHERE hashed_ip = ? AND remove_bg_used < ?`,
    [hashedIp, limit],
  );

  const changed = typeof result?.affectedRows === "number" ? result.affectedRows : 0;
  const allowed = changed > 0;
  const used = allowed ? usedBefore + 1 : usedBefore;
  return { allowed, used, limit };
}

export async function tryConsumeImageConversion(
  hashedIp: string,
  planCode: string = "visitor",
): Promise<{ allowed: boolean; used: number; limit: number; monthKey: string }> {
  const db = await getDb();
  const monthKey = monthKeyUTC();

  // Upsert: create row if missing, and reset counter when month changed.
  await db.execute(
    `INSERT INTO VisitorQuota (hashed_ip, remove_bg_used, image_convert_month, image_convert_used)
     VALUES (?, 0, ?, 0)
     ON DUPLICATE KEY UPDATE
       remove_bg_used = IF(image_convert_month = VALUES(image_convert_month), remove_bg_used, 0),
       image_convert_used = IF(image_convert_month = VALUES(image_convert_month), image_convert_used, 0),
       image_convert_month = VALUES(image_convert_month)`,
    [hashedIp, monthKey],
  );

  const limit =
    parseMonthlyLimitFromPlanOption({ planCode, service: "image_convert" }) ?? 10;
  const [beforeRows] = await db.execute<VisitorQuotaRow[]>(
    `SELECT image_convert_month, image_convert_used
     FROM VisitorQuota
     WHERE hashed_ip = ?
     LIMIT 1`,
    [hashedIp],
  );
  const usedBefore = Number(beforeRows[0]?.image_convert_used) || 0;
  if (limit >= Number.MAX_SAFE_INTEGER) {
    // Unlimited: do not increment, just allow.
    return { allowed: true, used: usedBefore, limit, monthKey };
  }
  if (usedBefore >= limit) {
    return { allowed: false, used: usedBefore, limit, monthKey };
  }

  const [result] = await db.execute<any>(
    `UPDATE VisitorQuota
     SET image_convert_used = image_convert_used + 1
     WHERE hashed_ip = ? AND image_convert_month = ? AND image_convert_used < ?`,
    [hashedIp, monthKey, limit],
  );

  const changed = typeof result?.affectedRows === "number" ? result.affectedRows : 0;
  const allowed = changed > 0;
  const used = allowed ? usedBefore + 1 : usedBefore;
  return { allowed, used, limit, monthKey };
}
