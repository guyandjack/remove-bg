// src/db.ts
import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectDb } from "../poolConnexion/poolConnexion";


// -----------------------------
// Types de base (adapte si besoin)
// -----------------------------
export type ID = string;
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "expired";

export interface User extends RowDataPacket {
  id: ID;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface Plan extends RowDataPacket {
  id: ID;
  name: string;
  price: number;
  is_archived: 0 | 1;
  created_at: Date;
}

export interface Subscription extends RowDataPacket {
  id: ID;
  user_id: ID;
  plan_id: ID;
  status: SubscriptionStatus;
  is_active: 1 | null; // 1: actif, NULL: inactif
  period_start: Date;
  period_end: Date;
  created_at: Date;
  updated_at: Date;
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
  const connexion = await connectDb()
  const theId = id ?? crypto.randomUUID(); // remplace par cuid() si tu préfères
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
  const connexion = await connectDb();
  const [rows] = await connexion.execute<User[]>(
    `SELECT * FROM User WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const connexion = await connectDb();
  const [rows] = await connexion.execute<User[]>(
    `SELECT * FROM User WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function listUser(limit = 50, offset = 0): Promise<User[]> {
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
  const connexion = await connectDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM User WHERE id = ?`,
    [userId]
  );
  return res.affectedRows === 1;
}

// ===================================================================
// PLANS — CRUD
// ===================================================================
export async function createPlan(name: string, price: number, id?: ID) {
  const connexion = await connectDb();
  const theId = id ?? crypto.randomUUID();
  const sql = `INSERT INTO Plan (id, name, price, is_archived) VALUES (?, ?, ?, 0)`;
  const [res] = await connexion.execute<ResultSetHeader>(sql, [theId, name, price]);
  return res.affectedRows === 1 ? theId : null;
}

export async function getPlanById(planId: ID): Promise<Plan | null> {
  const connexion = await connectDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE id = ? LIMIT 1`,
    [planId]
  );
  return rows[0] ?? null;
}

export async function getPlanByName(name: string): Promise<Plan | null> {
  const connexion = await connectDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE name = ? LIMIT 1`,
    [name]
  );
  return rows[0] ?? null;
}

export async function listPlans(includeArchived = false): Promise<Plan[]> {
  const connexion = await connectDb();
  const sql = includeArchived
    ? `SELECT * FROM Plan ORDER BY created_at DESC`
    : `SELECT * FROM Plan WHERE is_archived = 0 ORDER BY created_at DESC`;
  const [rows] = await connexion.query<Plan[]>(sql);
  return rows;
}

export async function updatePlan(
  planId: ID,
  fields: Partial<Pick<Plan, "name" | "price">>
) {
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
  if (sets.length === 0) return false;
  const sql = `UPDATE Plan SET ${sets.join(", ")} WHERE id = ?`;
  values.push(planId);
  const [res] = await connexion.execute<ResultSetHeader>(sql, values);
  return res.affectedRows === 1;
}

export async function archivePlan(planId: ID, archived = true) {
  const connexion = await connectDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE Plan SET is_archived = ? WHERE id = ?`,
    [archived ? 1 : 0, planId]
  );
  return res.affectedRows === 1;
}

export async function deletePlan(planId: ID) {
  // Attention: FK Subscription ON DELETE RESTRICT peut empêcher la suppression
  const connexion = await connectDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM Plan WHERE id = ?`,
    [planId]
  );
  return res.affectedRows === 1;
}

// ===================================================================
// SUBSCRIPTIONS — CRUD & logique d'affaires
// ===================================================================
export async function getActiveSubscription(
  userId: ID
): Promise<(Subscription & { plan_name: string; plan_price: number }) | null> {
  const connexion = await connectDb();
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

export async function listUserubscriptions(
  userId: ID
): Promise<(Subscription & { plan_name: string })[]> {
  const connexion = await connectDb();
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
      "status" | "is_active" | "period_start" | "period_end" | "plan_id"
    >
  >
) {
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

  if (sets.length === 0) return false;

  const sql = `UPDATE Subscription SET ${sets.join(", ")} WHERE id = ?`;
  values.push(subId);

  const [res] = await connexion.execute<ResultSetHeader>(sql, values);
  return res.affectedRows === 1;
}

export async function deleteSubscription(subId: ID) {
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
      `UPDATE Subscription SET status = 'canceled', is_active = NULL, period_end = ? WHERE id = ?`,
      [at, current.id]
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
        `UPDATE Subscription SET status = 'canceled', is_active = NULL, period_end = ? WHERE id = ?`,
        [now, current.id]
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
