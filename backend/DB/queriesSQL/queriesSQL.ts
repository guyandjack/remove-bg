// src/db.ts
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectDb } from "../poolConnexion/poolConnexion";
import crypto from "node:crypto";


// -----------------------------
// Types de base (adapte si besoin)
// -----------------------------
export type ID = string;
// Align status with schema (extended to support Stripe-like states)
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "expired"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "unpaid"
  | "paused";

export interface User extends RowDataPacket {
  id: ID;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface Plan extends RowDataPacket {
  id: ID;
  code: string; // e.g. 'free', 'hobby', 'pro'
  name: string;
  price: number; // cents or unit, matches schema column `price`
  currency: string; // 'EUR', 'USD', ...
  billing_interval: "day" | "week" | "month" | "year";
  daily_credit_quota: number;
  stripe_price_id: string | null;
  is_archived: 0 | 1;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription extends RowDataPacket {
  id: ID;
  user_id: ID;
  plan_id: ID;
  status: SubscriptionStatus;
  is_active: 1 | null; // 1: actif, NULL: inactif
  period_start: Date;
  period_end: Date;
  cancel_at: Date | null;
  canceled_at: Date | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  credit_initial: number;
  credit_used: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreditUsage extends RowDataPacket {
  id: ID;
  subscription_id: ID;
  used: number;
  reason: string;
  request_id: string | null;
  occurred_at: Date;
}

export interface SubscriptionUsage24h extends RowDataPacket {
  subscription_id: ID;
  user_id: ID;
  plan_id: ID;
  daily_credit_quota: number;
  used_last_24h: number;
  remaining_last_24h: number;
}




// ------------------------------------------------------
// Helper transaction — version simple
// ------------------------------------------------------
/**
 * Exécute plusieurs requêtes SQL dans une seule transaction.
 * Si une échoue → tout est annulé (rollback automatique).
 *
 * @param fn Une fonction async recevant la connexion transactionnelle.
 * @returns La valeur renvoyée par fn().
 */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const pool = await connectDb();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const result = await fn(conn); // exécute ton code utilisateur
    await conn.commit(); // valide tout
    return result;
  } catch (error) {
    await conn.rollback(); // annule tout
    throw error;
  } finally {
    conn.release(); // libère la connexion
  }
}

// -----------------------------
// Utils
// -----------------------------
export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

// ===================================================================
// User — CRUD
// ===================================================================
export async function createUser(email: string, passwordHash: string, id?: ID) {
  const connexion = await connectDb();
  const theId = id ?? crypto.randomUUID(); // you can swap with cuid() if preferred
  const sql = `
    INSERT INTO User (id, email, password_hash)
    VALUES (?, ?, ?)
  `;
  const [res] = await connexion.execute<ResultSetHeader>(sql, [
    theId,
    email,
    passwordHash,
  ]);
  return res.affectedRows === 1 ? theId : null;
}

export async function getUserById(userId: ID): Promise<User | null> {
  /**
   * SQL: SELECT * FROM User WHERE id = ? LIMIT 1
   */
  const connexion = await connectDb();
  const [rows] = await connexion.execute<User[]>(
    `SELECT * FROM User WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  /**
   * SQL: SELECT * FROM User WHERE email = ? LIMIT 1
   */
  const connexion = await connectDb();
  const [rows] = await connexion.execute<User[]>(
    `SELECT * FROM User WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}



export async function listUser(limit = 50, offset = 0): Promise<User[]> {
  /**
   * SQL: SELECT * FROM User ORDER BY created_at DESC LIMIT ? OFFSET ?
   */
  const connexion = await connectDb();
  const [rows] = await connexion.execute<User[]>(
    `SELECT * FROM User ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

export async function updateUser(
  userId: ID,
  fields: Partial<Pick<User, "email" | "password_hash">>
) {
  /**
   * SQL (dynamic SET): UPDATE User SET ... WHERE id = ?
   */
  const connexion = await connectDb();
  const sets: string[] = [];
  const values: any[] = [];
  if (fields.email !== undefined) {
    sets.push(`email = ?`);
    values.push(fields.email);
  }
  if (fields.password_hash !== undefined) {
    sets.push(`password_hash = ?`);
    values.push(fields.password_hash);
  }
  if (sets.length === 0) return false;
  const sql = `UPDATE User SET ${sets.join(", ")} WHERE id = ?`;
  values.push(userId);
  const [res] = await connexion.execute<ResultSetHeader>(sql, values);
  return res.affectedRows === 1;
}

export async function deleteUser(userId: ID) {
  // FK Subscription ON DELETE CASCADE supprime l'historique automatiquement
  /**
   * SQL: DELETE FROM User WHERE id = ?
   */
  const connexion = await connectDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM User WHERE id = ?`,
    [userId]
  );
  return res.affectedRows === 1;
}

// ===================================================================
// PLANS — CRUD & seed helpers (new schema)
// ===================================================================
/**
 * Create a minimal plan (legacy signature).
 * Only uses name + price. Other fields get defaults.
 */
export async function createPlan(name: string, price: number, id?: ID) {
  const connexion = await connectDb();
  const theId = id ?? crypto.randomUUID();
  const sql = `INSERT INTO Plan (id, code, name, price, currency, billing_interval, daily_credit_quota, is_archived)
               VALUES (?, LOWER(REPLACE(?, ' ', '_')), ?, ?, 'EUR', 'month', 0, 0)`;
  // code is derived from name by default (e.g., 'Pro Plan' -> 'pro_plan')
  const [res] = await connexion.execute<ResultSetHeader>(sql, [theId, name, name, price]);
  return res.affectedRows === 1 ? theId : null;
}

/**
 * Fetch one plan by primary key.
 * SQL: SELECT * FROM Plan WHERE id = ? LIMIT 1
 */
export async function getPlanById(planId: ID): Promise<Plan | null> {
  const connexion = await connectDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE id = ? LIMIT 1`,
    [planId]
  );
  return rows[0] ?? null;
}

/**
 * Fetch one plan by unique name.
 * SQL: SELECT * FROM Plan WHERE name = ? LIMIT 1
 */
export async function getPlanByName(name: string): Promise<Plan | null> {
  const connexion = await connectDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE name = ? LIMIT 1`,
    [name]
  );
  return rows[0] ?? null;
}

/**
 * Find a plan by code (e.g., 'free','hobby','pro').
 */
export async function getPlanByCode(code: string): Promise<Plan | null> {
  const connexion = await connectDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE code = ? LIMIT 1`,
    [code]
  );
  return rows[0] ?? null;
}

export async function listPlans(includeArchived = false): Promise<Plan[]> {
  /**
   * SQL: SELECT * FROM Plan [WHERE is_archived=0] ORDER BY created_at DESC
   */
  const connexion = await connectDb();
  const sql = includeArchived
    ? `SELECT * FROM Plan ORDER BY created_at DESC`
    : `SELECT * FROM Plan WHERE is_archived = 0 ORDER BY created_at DESC`;
  const [rows] = await connexion.query<Plan[]>(sql);
  return rows;
}

export async function updatePlan(
  planId: ID,
  fields: Partial<Pick<Plan, "name" | "price" | "currency" | "billing_interval" | "daily_credit_quota" | "stripe_price_id">>
) {
  /**
   * SQL (dynamic SET): UPDATE Plan SET ... WHERE id = ?
   */
  const connexion = await connectDb();
  const sets: string[] = [];
  const values: any[] = [];
  if (fields.name !== undefined) {
    sets.push(`name = ?`);
    values.push(fields.name);
  }
  if (fields.price !== undefined) {
    sets.push(`price = ?`);
    values.push(fields.price);
  }
  if (fields.currency !== undefined) {
    sets.push(`currency = ?`);
    values.push(fields.currency);
  }
  if (fields.billing_interval !== undefined) {
    sets.push(`billing_interval = ?`);
    values.push(fields.billing_interval);
  }
  if (fields.daily_credit_quota !== undefined) {
    sets.push(`daily_credit_quota = ?`);
    values.push(fields.daily_credit_quota);
  }
  if (fields.stripe_price_id !== undefined) {
    sets.push(`stripe_price_id = ?`);
    values.push(fields.stripe_price_id);
  }
  if (sets.length === 0) return false;
  const sql = `UPDATE Plan SET ${sets.join(", ")} WHERE id = ?`;
  values.push(planId);
  const [res] = await connexion.execute<ResultSetHeader>(sql, values);
  return res.affectedRows === 1;
}

export async function archivePlan(planId: ID, archived = true) {
  /**
   * SQL: UPDATE Plan SET is_archived = ? WHERE id = ?
   */
  const connexion = await connectDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE Plan SET is_archived = ? WHERE id = ?`,
    [archived ? 1 : 0, planId]
  );
  return res.affectedRows === 1;
}

export async function deletePlan(planId: ID) {
  // Attention: FK Subscription ON DELETE RESTRICT peut empêcher la suppression
  /**
   * SQL: DELETE FROM Plan WHERE id = ?
   */
  const connexion = await connectDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM Plan WHERE id = ?`,
    [planId]
  );
  return res.affectedRows === 1;
}

// ------------------------------------------------------
// PLANS — Seed helpers
// ------------------------------------------------------
/**
 * Ensure a plan exists by code; insert or update with provided attributes.
 * Returns the plan id.
 */
export async function upsertPlanByCode(input: {
  code: string;
  name: string;
  price: number;
  currency?: string;
  billing_interval?: "day" | "week" | "month" | "year";
  daily_credit_quota?: number;
  stripe_price_id?: string | null;
}): Promise<ID> {
  const connexion = await connectDb();
  const existing = await getPlanByCode(input.code);
  if (!existing) {
    const id = crypto.randomUUID();
    const sql = `INSERT INTO Plan (id, code, name, price, currency, billing_interval, daily_credit_quota, stripe_price_id, is_archived)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`;
    const params = [
      id,
      input.code,
      input.name,
      input.price,
      input.currency ?? "EUR",
      input.billing_interval ?? "month",
      input.daily_credit_quota ?? 0,
      input.stripe_price_id ?? null,
    ];
    const [res] = await connexion.execute<ResultSetHeader>(sql, params);
    if (res.affectedRows === 1) return id;
    throw new Error("Failed to insert plan " + input.code);
  } else {
    await updatePlan(existing.id, {
      name: input.name,
      price: input.price,
      currency: input.currency ?? existing.currency,
      billing_interval: input.billing_interval ?? existing.billing_interval,
      daily_credit_quota: input.daily_credit_quota ?? existing.daily_credit_quota,
      stripe_price_id: input.stripe_price_id ?? existing.stripe_price_id ?? undefined,
    });
    return existing.id;
  }
}

/**
 * Seed default plans (adjust values as needed).
 * - free: price 0, 10 credits/day
 * - hobby: 9.99€, 100 credits/day
 * - pro: 29.99€, 1000 credits/day
 */
export async function seedDefaultPlans() {
  await upsertPlanByCode({ code: "free", name: "Free", price: 0, currency: "EUR", billing_interval: "month", daily_credit_quota: 10 });
  await upsertPlanByCode({ code: "hobby", name: "Hobby", price: 500, currency: "EUR", billing_interval: "month", daily_credit_quota: 100 });
  await upsertPlanByCode({ code: "pro", name: "Pro", price: 1500, currency: "EUR", billing_interval: "month", daily_credit_quota: 1000 });
}

// ===================================================================
// SUBSCRIPTIONS — CRUD & logique d'affaires
// ===================================================================
/**
 * Fetch the active subscription for a user with plan details (name, price).
 * SQL: SELECT s.*, p.name AS plan_name, p.price AS plan_price FROM Subscription s JOIN Plan p ON p.id=s.plan_id WHERE s.user_id=? AND s.is_active=TRUE LIMIT 1
 */
export async function getActiveSubscription(
  userId: ID
): Promise<(Subscription & { plan_name: string; plan_price: number }) | null> {
  const connexion = await connectDb();
  // Active subscription with joined plan info (name, price)
  const [rows] = await connexion.execute<any[]>(
    `
    SELECT s.*, p.name AS plan_name, p.price AS plan_price
    FROM Subscription s
    JOIN Plan p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.is_active = TRUE
    LIMIT 1
    `,
    [userId]
  );
  return rows[0] ?? null;
}

/**
 * List all subscriptions for a user with joined plan name, most recent first.
 * SQL: SELECT s.*, p.name AS plan_name FROM Subscription s JOIN Plan p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.period_start DESC
 */
export async function listUserubscriptions(
  userId: ID
): Promise<(Subscription & { plan_name: string })[]> {
  const connexion = await connectDb();
  // History of subscriptions for a user, most recent first
  const [rows] = await connexion.execute<any[]>(
    `
    SELECT s.*, p.name AS plan_name
    FROM Subscription s
    JOIN Plan p ON p.id = s.plan_id
    WHERE s.user_id = ?
    ORDER BY s.period_start DESC
    `,
    [userId]
  );
  return rows as any[];
}

// Optional alias with corrected name (kept for convenience)
export const listUserSubscriptions = listUserubscriptions;

export interface CreateSubscriptionInput {
  userId: ID;
  planId: ID;
  status?: SubscriptionStatus; // default 'active'
  isActive?: boolean; // true => actif, sinon NULL
  periodStart?: Date; // default now
  periodEnd?: Date; // default +30 jours
  id?: ID;
}

/**
 * Crée une subscription.
 * ⚠️ Si isActive=true, il faut que l'index UNIQUE(user_id, is_active) soit en place
 * et qu'aucune autre ligne active n'existe (sinon erreur SQL).
 * Utilise switchPlan() pour gérer proprement le passage d'un plan à l'autre.
 */
export async function createSubscription(input: CreateSubscriptionInput) {
  const connexion = await connectDb();
  const now = new Date();
  const start = input.periodStart ?? now;
  const end = input.periodEnd ?? addDays(start, 30);
  const theId = input.id ?? crypto.randomUUID();

  // Create a subscription row. Stripe fields can be updated later.
  const sql = `
    INSERT INTO Subscription
      (id, user_id, plan_id, status, is_active, period_start, period_end)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const [res] = await connexion.execute<ResultSetHeader>(sql, [
    theId,
    input.userId,
    input.planId,
    input.status ?? "active",
    input.isActive ? 1 : null,
    start,
    end,
  ]);
  return res.affectedRows === 1 ? theId : null;
}

export async function getSubscriptionById(
  subId: ID
): Promise<Subscription | null> {
  /**
   * SQL: SELECT * FROM Subscription WHERE id = ? LIMIT 1
   */
  const connexion = await connectDb();
  const [rows] = await connexion.execute<Subscription[]>(
    `SELECT * FROM Subscription WHERE id = ? LIMIT 1`,
    [subId]
  );
  return rows[0] ?? null;
}

export async function updateSubscription(
  subId: ID,
  fields: Partial<
    Pick<
      Subscription,
      "status" | "is_active" | "period_start" | "period_end" | "plan_id" | "stripe_subscription_id" | "stripe_customer_id" | "cancel_at" | "canceled_at" | "credit_initial" | "credit_used"
    >
  >
) {
  /**
   * SQL (dynamic SET): UPDATE Subscription SET ... WHERE id = ?
   */
  const connexion = await connectDb();
  const sets: string[] = [];
  const values: any[] = [];

  if (fields.status !== undefined) {
    sets.push(`status = ?`);
    values.push(fields.status);
  }
  if (fields.is_active !== undefined) {
    sets.push(`is_active = ?`);
    values.push(fields.is_active);
  }
  if (fields.period_start !== undefined) {
    sets.push(`period_start = ?`);
    values.push(fields.period_start);
  }
  if (fields.period_end !== undefined) {
    sets.push(`period_end = ?`);
    values.push(fields.period_end);
  }
  if (fields.plan_id !== undefined) {
    sets.push(`plan_id = ?`);
    values.push(fields.plan_id);
  }
  if (fields.stripe_subscription_id !== undefined) {
    sets.push(`stripe_subscription_id = ?`);
    values.push(fields.stripe_subscription_id);
  }
  if (fields.stripe_customer_id !== undefined) {
    sets.push(`stripe_customer_id = ?`);
    values.push(fields.stripe_customer_id);
  }
  if (fields.cancel_at !== undefined) {
    sets.push(`cancel_at = ?`);
    values.push(fields.cancel_at);
  }
  if (fields.canceled_at !== undefined) {
    sets.push(`canceled_at = ?`);
    values.push(fields.canceled_at);
  }
  if (fields.credit_initial !== undefined) {
    sets.push(`credit_initial = ?`);
    values.push(fields.credit_initial);
  }
  if (fields.credit_used !== undefined) {
    sets.push(`credit_used = ?`);
    values.push(fields.credit_used);
  }

  if (sets.length === 0) return false;

  const sql = `UPDATE Subscription SET ${sets.join(", ")} WHERE id = ?`;
  values.push(subId);

  const [res] = await connexion.execute<ResultSetHeader>(sql, values);
  return res.affectedRows === 1;
}

export async function deleteSubscription(subId: ID) {
  /**
   * SQL: DELETE FROM Subscription WHERE id = ?
   */
  const connexion = await connectDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM Subscription WHERE id = ?`,
    [subId]
  );
  return res.affectedRows === 1;
}

// -------------------------------------------------------------------
// Logique : CANCEL l'abonnement actif (si présent)
// -------------------------------------------------------------------
export async function cancelActiveSubscription(
  userId: ID,
  at: Date = new Date()
) {
  return withTransaction(async (cx) => {
    const [rows] = await cx.execute<Subscription[]>(
      `SELECT * FROM Subscription WHERE user_id = ? AND is_active = TRUE LIMIT 1`,
      [userId]
    );
    const current = rows[0];
    if (!current) return false;

    const [res] = await cx.execute<ResultSetHeader>(
      `UPDATE Subscription SET status = 'canceled', is_active = NULL, period_end = ?, canceled_at = ? WHERE id = ?`,
      [at, at, current.id]
    );
    return res.affectedRows === 1;
  });
}

// -------------------------------------------------------------------
// Logique : SWITCH / UPGRADE de plan (transaction atomique)
// - Clôture l'actif courant (si existe)
// - Crée une nouvelle subscription active pour le nouveau plan
// - Respecte l'unicité (user_id, is_active)
// -------------------------------------------------------------------
export async function switchPlan(
  userId: ID,
  newPlanId: ID,
  now: Date = new Date()
) {
  return withTransaction(async (cx) => {
    // 1) Désactiver l'actuel (s'il existe)
    const [rows] = await cx.execute<Subscription[]>(
      `SELECT * FROM Subscription WHERE user_id = ? AND is_active = TRUE LIMIT 1`,
      [userId]
    );
    const current = rows[0];
    if (current) {
      await cx.execute(
        `UPDATE Subscription SET status = 'canceled', is_active = NULL, period_end = ?, canceled_at = ? WHERE id = ?`,
        [now, now, current.id]
      );
    }

    // 2) Créer le nouveau actif (période par défaut : 30 jours)
    const periodEnd = addDays(now, 30);
    const newId = crypto.randomUUID();
    await cx.execute(
      `
      INSERT INTO Subscription
        (id, user_id, plan_id, status, is_active, period_start, period_end)
      VALUES (?, ?, ?, 'active', TRUE, ?, ?)
      `,
      [newId, userId, newPlanId, now, periodEnd]
    );

    return newId;
  });
}

// -------------------------------------------------------------------
// Logique : RENEW (prolonge la période d'un actif)
// -------------------------------------------------------------------
export async function renewActiveSubscription(userId: ID, extraDays = 30) {
  return withTransaction(async (cx) => {
    const [rows] = await cx.execute<Subscription[]>(
      `SELECT * FROM Subscription WHERE user_id = ? AND is_active = TRUE LIMIT 1`,
      [userId]
    );
    const current = rows[0];
    if (!current) throw new Error("Aucun abonnement actif");

    const newEnd = addDays(new Date(current.period_end), extraDays);
    const [res] = await cx.execute<ResultSetHeader>(
      `UPDATE Subscription SET period_end = ? WHERE id = ?`,
      [newEnd, current.id]
    );
    return res.affectedRows === 1;
  });
}

// -------------------------------------------------------------------
// Logique : Activer une subscription spécifique (et désactiver l'actuelle)
// -------------------------------------------------------------------
export async function activateSubscription(
  userId: ID,
  subscriptionId: ID,
  now: Date = new Date()
) {
  return withTransaction(async (cx) => {
    // Désactiver l'actuelle
    await cx.execute(
      `UPDATE Subscription SET status = 'canceled', is_active = NULL, period_end = ? WHERE user_id = ? AND is_active = TRUE`,
      [now, userId]
    );
    // Activer la ciblée
    const [res] = await cx.execute<ResultSetHeader>(
      `UPDATE Subscription SET status = 'active', is_active = TRUE, period_start = ? WHERE id = ? AND user_id = ?`,
      [now, subscriptionId, userId]
    );
    return res.affectedRows === 1;
  });
}

// ===================================================================
// Credit usage — helpers (ledger + 24h window)
// ===================================================================
/**
 * Record a credit usage event for a subscription.
 * Use requestId to make the operation idempotent per external request.
 */
export async function recordCreditUsage(
  subscriptionId: ID,
  used = 1,
  reason: string = "api_call",
  requestId?: string
) {
  const connexion = await connectDb();
  const id = crypto.randomUUID();
  const sql = `INSERT INTO CreditUsage (id, subscription_id, used, reason, request_id)
               VALUES (?, ?, ?, ?, ?)`;
  const [res] = await connexion.execute<ResultSetHeader>(sql, [
    id,
    subscriptionId,
    used,
    reason,
    requestId ?? null,
  ]);
  return res.affectedRows === 1 ? id : null;
}

/**
 * Get usage and remaining credits over the last 24h for the active subscription of a user.
 * Relies on the SQL view v_subscription_usage_24h.
 */
export async function getActiveUsage24h(userId: ID): Promise<SubscriptionUsage24h | null> {
  const connexion = await connectDb();
  const [rows] = await connexion.execute<SubscriptionUsage24h[]>(
    `SELECT * FROM v_subscription_usage_24h WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

// ------------------------------------------------------
// Plan + crédits restants sur 24h (par utilisateur)
// ------------------------------------------------------
export interface UserPlanAndCreditsRow extends RowDataPacket {
  plan_code: string;
  remaining_last_24h: number;
}

/**
 * Retourne le type de plan (code: 'free' | 'hobby' | 'pro', etc.)
 * et le nombre de crédits restants sur 24h pour l'utilisateur donné.
 * S'appuie sur la vue `v_subscription_usage_24h` et la table `Plan`.
 */
export async function getUserPlanAndCredits24h(
  userId: ID
): Promise<{ plan: string; remaining_credits_24h: number } | null> {
  const connexion = await connectDb();
  const [rows] = await connexion.execute<UserPlanAndCreditsRow[]>(
    `SELECT plan_code, remaining_last_24h FROM v_subscription_usage_24h WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return { plan: row.plan_code, remaining_credits_24h: row.remaining_last_24h };
}

// ===================================================================
// Exemples d’utilisation (à enlever en prod)
// ===================================================================
// (async () => {
//   await initDb();
//   const userId = await createUser("alice@example.com", "hash");
//   const plan = await getPlanByName("Free");
//   if (userId && plan) {
//     await createSubscription({ userId, planId: plan.id, isActive: true });
//     console.log(await getActiveSubscription(userId));
//     // Upgrade vers Premium:
//     const premium = await getPlanByName("Premium");
//     if (premium) {
//       await switchPlan(userId, premium.id);
//       console.log(await getActiveSubscription(userId));
//     }
//   }
//   await closeDb();
// })();
