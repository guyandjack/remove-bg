import type { FieldPacket, QueryOptions, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { connectDb } from "../poolConnexion/poolConnexion.js";
import { planOption } from "../../data/planOption.js";
import { isPremiumAccessAllowed } from "../../services/subscription/access.js";

type DbExecute = <T>(
  sql: string | QueryOptions,
  values?: any,
) => Promise<[T, FieldPacket[]]>;

type DbQueryable = { execute: DbExecute; query: DbExecute };

async function getDb(): Promise<DbQueryable> {
  return (await connectDb()) as unknown as DbQueryable;
}

type SubscriptionStatus =
  | "active"
  | "canceling"
  | "canceled"
  | "past_due"
  | "expired"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "unpaid"
  | "paused";

type ActiveSubscriptionRow = RowDataPacket & {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  period_start: Date;
  period_end: Date;
  stripe_subscription_id: string | null;
  plan_access_until: Date | null;
  current_period_end: Date | null;
  plan_code: string;
};

type UserDeletionRow = RowDataPacket & {
  account_deletion_requested: 0 | 1;
};

type ConversionQuotaRow = RowDataPacket & {
  subscription_id: string;
  period_start: Date;
  period_end: Date;
  used: number;
};

function addMonthsKeepingDay(d: Date, months: number) {
  const date = new Date(d.getTime());
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  // If month overflowed (e.g. Jan 31 -> Mar 3), clamp to last day of target month.
  if (date.getDate() !== day) {
    date.setDate(0);
  }
  return date;
}

function parseConversionLimitFromPlanOption(planCode: string): { limit: number; isUnlimited: boolean } {
  const code = String(planCode || "").trim().toLowerCase();
  const cfg = planOption.find((p) => String(p.name || "").toLowerCase() === code);
  const raw = String((cfg as any)?.credit_conversion ?? "").trim();
  const normalized = raw.toLowerCase();
  const isUnlimited = [
    "infiny",
    "infinity",
    "infinite",
    "illimite",
    "illimité",
    "unlimited",
  ].includes(normalized);
  if (isUnlimited) return { limit: Number.MAX_SAFE_INTEGER, isUnlimited: true };
  const limit = Number(raw);
  if (!Number.isFinite(limit) || limit < 0) {
    // Safe default: no free unlimited access on misconfig
    return { limit: 0, isUnlimited: false };
  }
  return { limit, isUnlimited: false };
}

async function loadAccountDeletionRequested(userId: string): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.execute<UserDeletionRow[]>(
    `SELECT account_deletion_requested FROM \`User\` WHERE id = ? LIMIT 1`,
    [userId],
  );
  const flag = rows[0]?.account_deletion_requested ?? 0;
  return flag === 1;
}

async function loadActiveSubscriptionWithPlanCode(userId: string): Promise<ActiveSubscriptionRow | null> {
  const db = await getDb();
  const [rows] = await db.execute<ActiveSubscriptionRow[]>(
    `
    SELECT
      s.id,
      s.user_id,
      s.status,
      s.period_start,
      s.period_end,
      s.stripe_subscription_id,
      s.plan_access_until,
      s.current_period_end,
      p.code AS plan_code
    FROM Subscription s
    JOIN Plan p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.is_active = TRUE
    LIMIT 1
    `,
    [userId],
  );
  return rows[0] ?? null;
}

async function ensureSubscriptionPeriodCurrent(
  sub: ActiveSubscriptionRow,
  now: Date,
): Promise<ActiveSubscriptionRow | null> {
  const hasStripe = Boolean(sub.stripe_subscription_id);

  if (hasStripe) {
    const accountDeletionRequested = await loadAccountDeletionRequested(sub.user_id);
    const allowed = isPremiumAccessAllowed({
      subscriptionStatus: sub.status,
      accountDeletionRequested,
      planAccessUntil: sub.plan_access_until ? new Date(sub.plan_access_until) : null,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
      periodEnd: new Date(sub.period_end),
      now,
    });
    return allowed ? sub : null;
  }

  // Free plan: roll forward by whole months until now is inside [start, end).
  const end = new Date(sub.period_end);
  if (end.getTime() > now.getTime()) return sub;

  let newStart = new Date(sub.period_start);
  let newEnd = new Date(sub.period_end);
  let safety = 0;
  while (newEnd.getTime() <= now.getTime() && safety < 24) {
    newStart = newEnd;
    newEnd = addMonthsKeepingDay(newEnd, 1);
    safety += 1;
  }

  const db = await getDb();
  await db.execute<ResultSetHeader>(
    `UPDATE Subscription SET period_start = ?, period_end = ? WHERE id = ?`,
    [newStart, newEnd, sub.id],
  );

  return {
    ...sub,
    period_start: newStart,
    period_end: newEnd,
  };
}

async function ensureConversionQuotaRow(params: {
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const db = await getDb();
  await db.execute<ResultSetHeader>(
    `
    INSERT INTO SubscriptionConversionQuota (subscription_id, period_start, period_end, used)
    VALUES (?, ?, ?, 0)
    ON DUPLICATE KEY UPDATE
      used = IF(period_start = VALUES(period_start) AND period_end = VALUES(period_end), used, 0),
      period_start = VALUES(period_start),
      period_end = VALUES(period_end)
    `,
    [params.subscriptionId, params.periodStart, params.periodEnd],
  );
}

export type ConversionQuotaSnapshot = {
  subscriptionId: string;
  planCode: string;
  periodStart: Date;
  periodEnd: Date;
  used: number;
  limit: number;
  remaining: number; // -1 => unlimited
};

export async function getConversionQuotaSnapshotForUser(
  userId: string,
  now: Date = new Date(),
): Promise<ConversionQuotaSnapshot | null> {
  const sub0 = await loadActiveSubscriptionWithPlanCode(userId);
  if (!sub0) return null;

  const sub = await ensureSubscriptionPeriodCurrent(sub0, now);
  if (!sub) return null;

  const { limit, isUnlimited } = parseConversionLimitFromPlanOption(sub.plan_code);

  await ensureConversionQuotaRow({
    subscriptionId: sub.id,
    periodStart: new Date(sub.period_start),
    periodEnd: new Date(sub.period_end),
  });

  const db = await getDb();
  const [rows] = await db.execute<ConversionQuotaRow[]>(
    `SELECT subscription_id, period_start, period_end, used
     FROM SubscriptionConversionQuota
     WHERE subscription_id = ?
     LIMIT 1`,
    [sub.id],
  );
  const row = rows[0];
  const used = Number(row?.used) || 0;
  const remaining = isUnlimited ? -1 : Math.max(0, limit - used);

  return {
    subscriptionId: sub.id,
    planCode: sub.plan_code,
    periodStart: new Date(sub.period_start),
    periodEnd: new Date(sub.period_end),
    used,
    limit,
    remaining,
  };
}

export async function tryConsumeConversionCreditForUser(
  userId: string,
  now: Date = new Date(),
): Promise<{ allowed: boolean; snapshot: ConversionQuotaSnapshot | null }> {
  const snap = await getConversionQuotaSnapshotForUser(userId, now);
  if (!snap) return { allowed: false, snapshot: null };

  // Unlimited: allow and optionally increment to keep stats meaningful.
  const shouldIncrement = snap.remaining !== -1;
  if (!shouldIncrement) {
    return { allowed: true, snapshot: snap };
  }

  if (snap.remaining <= 0) {
    return { allowed: false, snapshot: snap };
  }

  const db = await getDb();
  const [res] = await db.execute<ResultSetHeader>(
    `
    UPDATE SubscriptionConversionQuota
    SET used = used + 1
    WHERE subscription_id = ? AND period_start = ? AND period_end = ? AND used < ?
    `,
    [snap.subscriptionId, snap.periodStart, snap.periodEnd, snap.limit],
  );
  const changed = typeof res?.affectedRows === "number" ? res.affectedRows : 0;
  if (changed <= 0) {
    const refreshed = await getConversionQuotaSnapshotForUser(userId, now);
    return { allowed: false, snapshot: refreshed };
  }

  const refreshed = await getConversionQuotaSnapshotForUser(userId, now);
  return { allowed: true, snapshot: refreshed };
}
