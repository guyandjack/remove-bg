/// <reference types="node" />

// src/db.ts
import type {
  FieldPacket,
  Pool,
  QueryOptions,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { connectDb } from "../poolConnexion/poolConnexion.js";
import crypto from "node:crypto";
import { isPremiumAccessAllowed } from "../../services/subscription/access.js";

type DbExecute = <T>(
  sql: string | QueryOptions,
  values?: any,
) => Promise<[T, FieldPacket[]]>;

type DbQueryable = {
  execute: DbExecute;
  query: DbExecute;
};

type DbTransactionConnection = DbQueryable & {
  beginTransaction: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release: () => void;
};

async function getDb(): Promise<DbQueryable> {
  // Defensive typing: in some TS setups `mysql2/promise` Pool loses inherited method types.
  return (await connectDb()) as unknown as DbQueryable;
}

async function getPool(): Promise<Pool> {
  // Same reason as `getDb()`: keep a single, well-typed entry point.
  return (await connectDb()) as unknown as Pool;
}

// -----------------------------
// Types de base (adapte si besoin)
// -----------------------------
export type ID = string;
// Align status with schema (extended to support Stripe-like states)
export type SubscriptionStatus =
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

export interface User extends RowDataPacket {
  id: ID;
  email: string;
  password_hash: string;
  marketing_consent: 0 | 1;
  marketing_consent_updated_at: Date | null;
  account_deletion_requested: 0 | 1;
  account_deletion_requested_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Plan extends RowDataPacket {
  id: ID;
  code: string; // e.g. 'free', 'hobby', 'pro'
  name: string;
  price: number; // cents or unit, matches schema column `price`
  currency_code: string; // 'EUR', 'USD', ...
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
  stripe_cancel_at_period_end: 0 | 1;
  current_period_end: Date | null;
  plan_access_until: Date | null;
  pending_plan_id: ID | null;
  pending_change_type: "upgrade" | "downgrade" | null;
  pending_change_effective_at: Date | null;
  stripe_schedule_id: string | null;
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

export interface SubscriptionUsageBillingPeriod extends RowDataPacket {
  subscription_id: ID;
  user_id: ID;
  plan_id: ID;
  period_start: Date;
  period_end: Date;
  // Keeping the column name for backward compatibility in existing code/DB.
  // Semantics: monthly credit quota (billing period), not "daily".
  daily_credit_quota: number;
  used_in_period: number;
  remaining_in_period: number;
}

export interface Customer extends RowDataPacket {
  id: ID;
  user_id: ID;
  email: string;
  first_name: string | null;
  last_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  stripe_customer_id: string | null;
  total_spent_cents: number;
  created_at: Date;
  updated_at: Date;
}

export interface StripeCheckoutSessionState extends RowDataPacket {
  id: ID;
  session_id: string;
  email: string;
  plan_code: string;
  plan_id: ID | null;
  currency_code: string;
  status: "pending" | "completed" | "failed";
  user_id: ID | null;
  subscription_id: ID | null;
  last_error: string | null;
  consumed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProcessedWebhookEvent extends RowDataPacket {
  id: string;
  provider: string;
  event_type: string;
  received_at: Date;
  processed_at: Date | null;
}

export type RemoveBgJobStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

function stringifyJsonForDb(value: unknown): string | null {
  if (value == null) return null;

  // MariaDB (prod) matérialise JSON via LONGTEXT + CHECK(json_valid(...)).
  // Donc on doit binder une string JSON valide, jamais un objet JS non-stringifié.
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      // Empty string is not valid JSON under json_valid(''), so store JSON string instead.
      return JSON.stringify(value);
    }

    // If already valid JSON text, keep it as-is to avoid double-encoding.
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // Not JSON => store it as a JSON string.
      return JSON.stringify(value);
    }
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  // Objects/arrays: safe stringify with circular-reference handling.
  const seen = new WeakSet<object>();
  const json = JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object") {
      const asObj = v as object;
      if (seen.has(asObj)) return "[Circular]";
      seen.add(asObj);
    }
    if (typeof v === "bigint") {
      // JSON does not support BigInt: keep it representable.
      return v.toString();
    }
    return v;
  });

  // Guard rail: avoid gigantic payloads that can hit max_allowed_packet.
  // Keep it JSON-valid even when reduced.
  const MAX_CHARS = 1_000_000;
  if (json && json.length > MAX_CHARS) {
    return JSON.stringify({
      truncated: true,
      originalLength: json.length,
      preview: json.slice(0, 50_000),
    });
  }

  return json ?? null;
}

export interface RemoveBgJob extends RowDataPacket {
  id: ID;
  user_id: ID | null;
  request_id: string;
  idempotency_key: string;
  replicate_prediction_id: string | null;
  status: RemoveBgJobStatus;
  replicate_status: string | null;
  input_image_url: string | null;
  output_image_url: string | null;
  replicate_payload: any | null;
  error_message: string | null;
  credits_debited_at: Date | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface RemoveBgVisitorJob extends RowDataPacket {
  id: ID;
  visitor_hashed_ip: string;
  request_id: string;
  idempotency_key: string;
  access_token: string;
  replicate_prediction_id: string | null;
  status: RemoveBgJobStatus;
  replicate_status: string | null;
  output_image_url: string | null;
  replicate_payload: any | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export async function tryMarkWebhookEventReceived(params: {
  id: string;
  provider?: string;
  eventType: string;
  receivedAt?: Date;
}): Promise<{ shouldProcess: boolean }> {
  const connexion = await getDb();
  try {
    await connexion.execute<ResultSetHeader>(
      `INSERT INTO ProcessedWebhookEvent (id, provider, event_type, received_at)
       VALUES (?, ?, ?, ?)`,
      [
        params.id,
        params.provider ?? "stripe",
        params.eventType,
        params.receivedAt ?? new Date(),
      ],
    );
    return { shouldProcess: true };
  } catch (err: any) {
    // Duplicate => may already be processed, or may have crashed before processed_at was set.
    if (err?.code === "ER_DUP_ENTRY") {
      const [rows] = await connexion.execute<ProcessedWebhookEvent[]>(
        `SELECT processed_at FROM ProcessedWebhookEvent WHERE id = ? LIMIT 1`,
        [params.id],
      );
      const processedAt = rows[0]?.processed_at ?? null;
      return { shouldProcess: processedAt == null };
    }
    throw err;
  }
}

export async function markWebhookEventProcessed(params: {
  id: string;
  processedAt?: Date;
}): Promise<void> {
  const connexion = await getDb();
  await connexion.execute<ResultSetHeader>(
    `UPDATE ProcessedWebhookEvent SET processed_at = ? WHERE id = ?`,
    [params.processedAt ?? new Date(), params.id],
  );
}

function normalizeRemoveBgShortKey(input: unknown, field: string): string {
  const value = String(input ?? "").trim();
  if (!value) {
    throw new Error(`${field} is required`);
  }
  if (value.length > 64) {
    throw new Error(`${field} is too long (max 64 chars)`);
  }
  return value;
}

function normalizeRemoveBgRequestId(input: unknown): string {
  return normalizeRemoveBgShortKey(input, "RemoveBgJobs.request_id");
}

function normalizeRemoveBgIdempotencyKey(input: unknown): string {
  return normalizeRemoveBgShortKey(input, "RemoveBgJobs.idempotency_key");
}

function normalizeRemoveBgVisitorRequestId(input: unknown): string {
  return normalizeRemoveBgShortKey(input, "RemoveBgVisitorJobs.request_id");
}

function normalizeRemoveBgVisitorIdempotencyKey(input: unknown): string {
  return normalizeRemoveBgShortKey(input, "RemoveBgVisitorJobs.idempotency_key");
}

function normalizeRemoveBgVisitorAccessToken(input: unknown): string {
  return normalizeRemoveBgShortKey(input, "RemoveBgVisitorJobs.access_token");
}

function normalizeVisitorHashedIp(input: unknown): string {
  const value = String(input ?? "").trim();
  if (!value) {
    throw new Error("RemoveBgVisitorJobs.visitor_hashed_ip is required");
  }
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("RemoveBgVisitorJobs.visitor_hashed_ip is invalid");
  }
  return value.toLowerCase();
}

export async function createRemoveBgJobIdempotent(params: {
  requestId: string;
  idempotencyKey: string;
  userId?: ID | null;
}): Promise<RemoveBgJob> {
  const requestId = normalizeRemoveBgRequestId(params.requestId);
  const idempotencyKey = normalizeRemoveBgIdempotencyKey(params.idempotencyKey);
  const connexion = await getDb();
  const id = crypto.randomUUID();
  const userId = params.userId ?? null;

  try {
    await connexion.execute<ResultSetHeader>(
      `INSERT INTO RemoveBgJobs (id, user_id, request_id, idempotency_key, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [id, userId, requestId, idempotencyKey],
    );
    const created = await getRemoveBgJobById(id);
    if (!created) {
      throw new Error("RemoveBgJobs insert succeeded but row not found");
    }
    return created;
  } catch (err: any) {
    // Idempotence: if a unique constraint is hit, return the existing row.
    if (err && err.code === "ER_DUP_ENTRY") {
      const byRequest = await getRemoveBgJobByRequestId(requestId);
      if (byRequest) return byRequest;

      const byUserKey = await getRemoveBgJobByUserIdAndIdempotencyKey({
        userId,
        idempotencyKey,
      });
      if (byUserKey) return byUserKey;

      throw new Error(
        "Duplicate RemoveBgJobs insert but existing row could not be loaded",
      );
    }
    throw err;
  }
}

export async function getRemoveBgJobById(id: ID): Promise<RemoveBgJob | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<RemoveBgJob[]>(
    `SELECT * FROM RemoveBgJobs WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getRemoveBgJobByRequestId(
  requestId: string,
): Promise<RemoveBgJob | null> {
  const normalized = normalizeRemoveBgRequestId(requestId);
  const connexion = await getDb();
  const [rows] = await connexion.execute<RemoveBgJob[]>(
    `SELECT * FROM RemoveBgJobs WHERE request_id = ? LIMIT 1`,
    [normalized],
  );
  return rows[0] ?? null;
}

export async function getRemoveBgJobByUserIdAndIdempotencyKey(params: {
  userId: ID | null;
  idempotencyKey: string;
}): Promise<RemoveBgJob | null> {
  // If userId is null, the uniqueness contract does not apply reliably.
  if (!params.userId) return null;
  const idempotencyKey = normalizeRemoveBgIdempotencyKey(params.idempotencyKey);
  const connexion = await getDb();
  const [rows] = await connexion.execute<RemoveBgJob[]>(
    `SELECT * FROM RemoveBgJobs WHERE user_id = ? AND idempotency_key = ? LIMIT 1`,
    [params.userId, idempotencyKey],
  );
  return rows[0] ?? null;
}

export async function getRemoveBgJobByReplicatePredictionId(
  replicatePredictionId: string,
): Promise<RemoveBgJob | null> {
  const normalized = String(replicatePredictionId ?? "").trim();
  if (!normalized) {
    throw new Error("RemoveBgJobs.replicate_prediction_id is required");
  }
  const connexion = await getDb();
  const [rows] = await connexion.execute<RemoveBgJob[]>(
    `SELECT * FROM RemoveBgJobs WHERE replicate_prediction_id = ? LIMIT 1`,
    [normalized],
  );
  return rows[0] ?? null;
}

export async function setRemoveBgJobRunning(params: {
  requestId: string;
  replicatePredictionId: string;
  replicateStatus?: string | null;
  inputImageUrl?: string | null;
  replicatePayload?: any | null;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgRequestId(params.requestId);
  const replicatePredictionId = String(params.replicatePredictionId ?? "").trim();
  if (!replicatePredictionId) {
    throw new Error("RemoveBgJobs.replicate_prediction_id is required");
  }
  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);

  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgJobs
     SET status = 'processing',
         replicate_prediction_id = ?,
         replicate_status = COALESCE(?, replicate_status),
         input_image_url = COALESCE(?, input_image_url),
         replicate_payload = COALESCE(?, replicate_payload)
     WHERE request_id = ?
       AND status IN ('pending','processing')
       AND (replicate_prediction_id IS NULL OR replicate_prediction_id = ?)`,
    [
      replicatePredictionId,
      params.replicateStatus ?? null,
      params.inputImageUrl ?? null,
      replicatePayloadJson,
      requestId,
      replicatePredictionId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function markRemoveBgJobSucceeded(params: {
  requestId: string;
  outputImageUrl: string;
  replicateStatus?: string | null;
  replicatePayload?: any | null;
  completedAt?: Date;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgRequestId(params.requestId);
  const outputImageUrl = String(params.outputImageUrl ?? "").trim();
  if (!outputImageUrl) {
    throw new Error("RemoveBgJobs.output_image_url is required");
  }
  const now = params.completedAt ?? new Date();
  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgJobs
     SET status = 'succeeded',
         output_image_url = ?,
         replicate_status = COALESCE(?, replicate_status),
         replicate_payload = COALESCE(?, replicate_payload),
         error_message = NULL,
         completed_at = ?
      WHERE request_id = ?
        AND status <> 'succeeded'`,
    [
      outputImageUrl,
      params.replicateStatus ?? null,
      replicatePayloadJson,
      now,
      requestId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function markRemoveBgJobFailed(params: {
  requestId: string;
  errorMessage: string;
  replicateStatus?: string | null;
  replicatePayload?: any | null;
  completedAt?: Date;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgRequestId(params.requestId);
  const errorMessage = String(params.errorMessage ?? "").trim();
  if (!errorMessage) throw new Error("RemoveBgJobs.error_message is required");

  const now = params.completedAt ?? new Date();
  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgJobs
     SET status = 'failed',
         error_message = ?,
         replicate_status = COALESCE(?, replicate_status),
         replicate_payload = COALESCE(?, replicate_payload),
         completed_at = ?
      WHERE request_id = ?
        AND status <> 'succeeded'`,
    [
      errorMessage,
      params.replicateStatus ?? null,
      replicatePayloadJson,
      now,
      requestId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function markRemoveBgJobCanceled(params: {
  requestId: string;
  errorMessage?: string | null;
  replicateStatus?: string | null;
  replicatePayload?: any | null;
  completedAt?: Date;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgRequestId(params.requestId);
  const now = params.completedAt ?? new Date();
  const errorMessage = params.errorMessage
    ? String(params.errorMessage).trim()
    : null;

  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgJobs
     SET status = 'canceled',
         error_message = ?,
         replicate_status = COALESCE(?, replicate_status),
         replicate_payload = COALESCE(?, replicate_payload),
         completed_at = ?
     WHERE request_id = ?
       AND status <> 'succeeded'`,
    [
      errorMessage,
      params.replicateStatus ?? null,
      replicatePayloadJson,
      now,
      requestId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function markRemoveBgJobCreditsDebited(params: {
  requestId: string;
  debitedAt?: Date;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgRequestId(params.requestId);
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgJobs
     SET credits_debited_at = ?
     WHERE request_id = ?
       AND credits_debited_at IS NULL`,
    [params.debitedAt ?? new Date(), requestId],
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function backfillRemoveBgJobOutputIfMissing(params: {
  requestId: string;
  outputImageUrl: string;
  replicateStatus?: string | null;
  replicatePayload?: any | null;
  completedAt?: Date;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgRequestId(params.requestId);
  const outputImageUrl = String(params.outputImageUrl ?? "").trim();
  if (!outputImageUrl) {
    throw new Error("RemoveBgJobs.output_image_url is required");
  }
  const now = params.completedAt ?? new Date();

  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgJobs
     SET output_image_url = COALESCE(NULLIF(output_image_url, ''), ?),
         replicate_status = COALESCE(?, replicate_status),
         replicate_payload = COALESCE(?, replicate_payload),
         completed_at = COALESCE(completed_at, ?)
     WHERE request_id = ?
       AND status = 'succeeded'
       AND (output_image_url IS NULL OR output_image_url = '')`,
    [
      outputImageUrl,
      params.replicateStatus ?? null,
      replicatePayloadJson,
      now,
      requestId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

// ------------------------------------------------------
// Remove BG visitor jobs (Replicate async flow, no auth)
// ------------------------------------------------------
export async function createRemoveBgVisitorJobIdempotent(params: {
  requestId: string;
  idempotencyKey: string;
  visitorHashedIp: string;
  accessToken?: string;
}): Promise<RemoveBgVisitorJob> {
  const requestId = normalizeRemoveBgVisitorRequestId(params.requestId);
  const idempotencyKey = normalizeRemoveBgVisitorIdempotencyKey(params.idempotencyKey);
  const visitorHashedIp = normalizeVisitorHashedIp(params.visitorHashedIp);
  const accessToken = normalizeRemoveBgVisitorAccessToken(
    params.accessToken ?? crypto.randomBytes(16).toString("hex"),
  );

  const connexion = await getDb();
  const id = crypto.randomUUID();

  try {
    await connexion.execute<ResultSetHeader>(
      `INSERT INTO RemoveBgVisitorJobs (id, visitor_hashed_ip, request_id, idempotency_key, access_token, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [id, visitorHashedIp, requestId, idempotencyKey, accessToken],
    );
    const created = await getRemoveBgVisitorJobById(id);
    if (!created) {
      throw new Error("RemoveBgVisitorJobs insert succeeded but row not found");
    }
    return created;
  } catch (err: any) {
    if (err && err.code === "ER_DUP_ENTRY") {
      const byRequest = await getRemoveBgVisitorJobByRequestId(requestId);
      if (byRequest) return byRequest;

      const byVisitorKey = await getRemoveBgVisitorJobByVisitorHashAndIdempotencyKey({
        visitorHashedIp,
        idempotencyKey,
      });
      if (byVisitorKey) return byVisitorKey;

      throw new Error(
        "Duplicate RemoveBgVisitorJobs insert but existing row could not be loaded",
      );
    }
    throw err;
  }
}

export async function getRemoveBgVisitorJobById(
  id: ID,
): Promise<RemoveBgVisitorJob | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<RemoveBgVisitorJob[]>(
    `SELECT * FROM RemoveBgVisitorJobs WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function getRemoveBgVisitorJobByRequestId(
  requestId: string,
): Promise<RemoveBgVisitorJob | null> {
  const normalized = normalizeRemoveBgVisitorRequestId(requestId);
  const connexion = await getDb();
  const [rows] = await connexion.execute<RemoveBgVisitorJob[]>(
    `SELECT * FROM RemoveBgVisitorJobs WHERE request_id = ? LIMIT 1`,
    [normalized],
  );
  return rows[0] ?? null;
}

export async function getRemoveBgVisitorJobByVisitorHashAndIdempotencyKey(params: {
  visitorHashedIp: string;
  idempotencyKey: string;
}): Promise<RemoveBgVisitorJob | null> {
  const visitorHashedIp = normalizeVisitorHashedIp(params.visitorHashedIp);
  const idempotencyKey = normalizeRemoveBgVisitorIdempotencyKey(params.idempotencyKey);
  const connexion = await getDb();
  const [rows] = await connexion.execute<RemoveBgVisitorJob[]>(
    `SELECT * FROM RemoveBgVisitorJobs WHERE visitor_hashed_ip = ? AND idempotency_key = ? LIMIT 1`,
    [visitorHashedIp, idempotencyKey],
  );
  return rows[0] ?? null;
}

export async function getRemoveBgVisitorJobByReplicatePredictionId(
  replicatePredictionId: string,
): Promise<RemoveBgVisitorJob | null> {
  const normalized = String(replicatePredictionId ?? "").trim();
  if (!normalized) {
    throw new Error("RemoveBgVisitorJobs.replicate_prediction_id is required");
  }
  const connexion = await getDb();
  const [rows] = await connexion.execute<RemoveBgVisitorJob[]>(
    `SELECT * FROM RemoveBgVisitorJobs WHERE replicate_prediction_id = ? LIMIT 1`,
    [normalized],
  );
  return rows[0] ?? null;
}

export async function setRemoveBgVisitorJobRunning(params: {
  requestId: string;
  replicatePredictionId: string;
  replicateStatus?: string | null;
  replicatePayload?: any | null;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgVisitorRequestId(params.requestId);
  const replicatePredictionId = String(params.replicatePredictionId ?? "").trim();
  if (!replicatePredictionId) {
    throw new Error("RemoveBgVisitorJobs.replicate_prediction_id is required");
  }
  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);

  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgVisitorJobs
     SET status = 'processing',
         replicate_prediction_id = ?,
         replicate_status = COALESCE(?, replicate_status),
         replicate_payload = COALESCE(?, replicate_payload)
     WHERE request_id = ?
       AND status IN ('pending','processing')
       AND (replicate_prediction_id IS NULL OR replicate_prediction_id = ?)`,
    [
      replicatePredictionId,
      params.replicateStatus ?? null,
      replicatePayloadJson,
      requestId,
      replicatePredictionId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function markRemoveBgVisitorJobSucceeded(params: {
  requestId: string;
  outputImageUrl: string;
  replicateStatus?: string | null;
  replicatePayload?: any | null;
  completedAt?: Date;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgVisitorRequestId(params.requestId);
  const outputImageUrl = String(params.outputImageUrl ?? "").trim();
  if (!outputImageUrl) {
    throw new Error("RemoveBgVisitorJobs.output_image_url is required");
  }
  const now = params.completedAt ?? new Date();
  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgVisitorJobs
     SET status = 'succeeded',
         output_image_url = ?,
         replicate_status = COALESCE(?, replicate_status),
         replicate_payload = COALESCE(?, replicate_payload),
         error_message = NULL,
         completed_at = ?
     WHERE request_id = ?
       AND status <> 'succeeded'`,
    [
      outputImageUrl,
      params.replicateStatus ?? null,
      replicatePayloadJson,
      now,
      requestId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function markRemoveBgVisitorJobFailed(params: {
  requestId: string;
  errorMessage: string;
  replicateStatus?: string | null;
  replicatePayload?: any | null;
  completedAt?: Date;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgVisitorRequestId(params.requestId);
  const errorMessage = String(params.errorMessage ?? "").trim();
  if (!errorMessage) throw new Error("RemoveBgVisitorJobs.error_message is required");

  const now = params.completedAt ?? new Date();
  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgVisitorJobs
     SET status = 'failed',
         error_message = ?,
         replicate_status = COALESCE(?, replicate_status),
         replicate_payload = COALESCE(?, replicate_payload),
         completed_at = ?
     WHERE request_id = ?
       AND status <> 'succeeded'`,
    [
      errorMessage,
      params.replicateStatus ?? null,
      replicatePayloadJson,
      now,
      requestId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

export async function markRemoveBgVisitorJobCanceled(params: {
  requestId: string;
  errorMessage?: string | null;
  replicateStatus?: string | null;
  replicatePayload?: any | null;
  completedAt?: Date;
}): Promise<boolean> {
  const requestId = normalizeRemoveBgVisitorRequestId(params.requestId);
  const now = params.completedAt ?? new Date();
  const errorMessage = params.errorMessage ? String(params.errorMessage).trim() : null;

  const connexion = await getDb();
  const replicatePayloadJson = stringifyJsonForDb(params.replicatePayload ?? null);
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE RemoveBgVisitorJobs
     SET status = 'canceled',
         error_message = ?,
         replicate_status = COALESCE(?, replicate_status),
         replicate_payload = COALESCE(?, replicate_payload),
         completed_at = ?
     WHERE request_id = ?
       AND status <> 'succeeded'`,
    [
      errorMessage,
      params.replicateStatus ?? null,
      replicatePayloadJson,
      now,
      requestId,
    ],
  );
  return (res.affectedRows ?? 0) > 0;
}

// ------------------------------------------------------
// Helper transaction â€” version simple
// ------------------------------------------------------
/**
 * ExÃ©cute plusieurs requÃªtes SQL dans une seule transaction.
 * Si une Ã©choue â†’ tout est annulÃ© (rollback automatique).
 *
 * @param fn Une fonction async recevant la connexion transactionnelle.
 * @returns La valeur renvoyÃ©e par fn().
 */
export async function withTransaction<T>(
  fn: (conn: DbTransactionConnection) => Promise<T>,
): Promise<T> {
  const pool = await getPool();
  const conn = (await (pool as any).getConnection()) as DbTransactionConnection;

  try {
    await conn.beginTransaction();
    const result = await fn(conn); // exÃ©cute ton code utilisateur
    await conn.commit(); // valide tout
    return result;
  } catch (error) {
    await conn.rollback(); // annule tout
    throw error;
  } finally {
    conn.release(); // libÃ¨re la connexion
  }
}

// -----------------------------
// Utils
// -----------------------------
export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addMonthsKeepingDay(d: Date, months: number) {
  const date = new Date(d.getTime());
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  // If month overflowed (e.g. Jan 31 -> Mar 3), clamp to last day of target month.
  if (date.getDate() !== day) {
    date.setDate(0);
  }
  return date;
}

// ===================================================================
// TokenRefresh â€” CRUD
// ===================================================================
export interface TokenRefresh extends RowDataPacket {
  id: ID;
  jti: string;
  user_id: ID;
  revoked: 0 | 1;
  revoked_at: Date | null;
  replaced_by_jti: string | null;
  token_hash: Buffer | null;
  ip: string | null;
  user_agent: string | null;
  issued_at: Date;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export function sha256Buffer(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

export async function createRefreshTokenRecord(input: {
  jti: string;
  userId: ID;
  expiresAt: Date;
  token?: string; // to hash & store optionally
  ip?: string | null;
  userAgent?: string | null;
  issuedAt?: Date | null;
  replacedByJti?: string | null;
  id?: ID;
}): Promise<ID | null> {
  const connexion = await getDb();
  const theId = input.id ?? crypto.randomUUID();
  const tokenHash = input.token ? sha256Buffer(input.token) : null;
  const sql = `
    INSERT INTO TokenRefresh
      (id, jti, user_id, revoked, revoked_at, replaced_by_jti, token_hash, ip, user_agent, issued_at, expires_at)
    VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?)
  `;
  const [res] = await connexion.execute<ResultSetHeader>(sql, [
    theId,
    input.jti,
    input.userId,
    input.replacedByJti ?? null,
    tokenHash,
    input.ip ?? null,
    input.userAgent ?? null,
    input.issuedAt ?? new Date(),
    input.expiresAt,
  ]);
  return res.affectedRows === 1 ? theId : null;
}

export async function getRefreshTokenByJti(
  jti: string,
): Promise<TokenRefresh | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<TokenRefresh[]>(
    `SELECT * FROM TokenRefresh WHERE jti = ? LIMIT 1`,
    [jti],
  );
  return rows[0] ?? null;
}

export async function findValidRefreshTokenByJti(
  jti: string,
  userId?: ID,
): Promise<TokenRefresh | null> {
  const connexion = await getDb();
  const now = new Date();
  const sql = `
    SELECT * FROM TokenRefresh
    WHERE jti = ?
      AND revoked = 0
      AND expires_at > ?
      ${userId ? "AND user_id = ?" : ""}
    LIMIT 1
  `;
  const params: any[] = [jti, now];
  if (userId) params.push(userId);
  const [rows] = await connexion.execute<TokenRefresh[]>(sql, params);
  return rows[0] ?? null;
}

export async function revokeRefreshToken(
  jti: string,
  replacedByJti: string | null = null,
): Promise<boolean> {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE TokenRefresh SET revoked = 1, revoked_at = NOW(), replaced_by_jti = ? WHERE jti = ? AND revoked = 0`,
    [replacedByJti, jti],
  );
  return res.affectedRows === 1;
}

export async function revokeAllRefreshTokensForUser(
  userId: ID,
): Promise<number> {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE TokenRefresh SET revoked = 1, revoked_at = NOW() WHERE user_id = ? AND revoked = 0`,
    [userId],
  );
  return res.affectedRows;
}

export async function revokeAllRefreshTokensForUserExcept(
  userId: ID,
  exceptJti: string,
): Promise<number> {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE TokenRefresh
     SET revoked = 1, revoked_at = NOW()
     WHERE user_id = ? AND revoked = 0 AND jti <> ?`,
    [userId, exceptJti],
  );
  return res.affectedRows;
}

export async function deleteRefreshTokenByJti(jti: string): Promise<boolean> {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM TokenRefresh WHERE jti = ?`,
    [jti],
  );
  return res.affectedRows === 1;
}

export async function purgeExpiredRefreshTokens(): Promise<number> {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM TokenRefresh WHERE expires_at <= NOW()`,
  );
  return res.affectedRows;
}

export async function listRefreshTokensForUser(
  userId: ID,
  limit = 50,
  offset = 0,
): Promise<TokenRefresh[]> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<TokenRefresh[]>(
    `SELECT * FROM TokenRefresh WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  );
  return rows;
}

// ===================================================================
// User â€” CRUD
// ===================================================================
export async function createUser(email: string, passwordHash: string, id?: ID) {
  const connexion = await getDb();
  const theId = id ?? crypto.randomUUID(); // you can swap with cuid() if preferred
  const sql = `
    INSERT INTO \`User\` (id, email, password_hash)
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
  const connexion = await getDb();
  const [rows] = await connexion.execute<User[]>(
    `SELECT * FROM \`User\` WHERE id = ? LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  /**
   * SQL: SELECT * FROM User WHERE email = ? LIMIT 1
   */
  const connexion = await getDb();
  const [rows] = await connexion.execute<User[]>(
    `SELECT * FROM \`User\` WHERE email = ? LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function listUser(limit = 50, offset = 0): Promise<User[]> {
  /**
   * SQL: SELECT * FROM User ORDER BY created_at DESC LIMIT ? OFFSET ?
   */
  const connexion = await getDb();
  const [rows] = await connexion.execute<User[]>(
    `SELECT * FROM \`User\` ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows;
}

export async function updateUser(
  userId: ID,
  fields: Partial<Pick<User, "email" | "password_hash">>,
) {
  /**
   * SQL (dynamic SET): UPDATE User SET ... WHERE id = ?
   */
  const connexion = await getDb();
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
  const sql = `UPDATE \`User\` SET ${sets.join(", ")} WHERE id = ?`;
  values.push(userId);
  const [res] = await connexion.execute<ResultSetHeader>(sql, values);
  return res.affectedRows === 1;
}

export async function updateUserMarketingConsent(
  userId: ID,
  marketingConsent: boolean,
  at: Date = new Date(),
) {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE \`User\`
     SET marketing_consent = ?, marketing_consent_updated_at = ?
     WHERE id = ?`,
    [marketingConsent ? 1 : 0, at, userId],
  );
  return res.affectedRows === 1;
}

export async function requestAccountDeletion(
  userId: ID,
  at: Date = new Date(),
) {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE \`User\`
     SET account_deletion_requested = 1, account_deletion_requested_at = ?
     WHERE id = ?`,
    [at, userId],
  );
  return res.affectedRows === 1;
}

export async function createAccountDeletionFeedbackRequest(params: {
  userId: ID;
  tokenHash: string;
  requestedAt?: Date;
  expiresAt: Date;
}) {
  const connexion = await getDb();
  const id = crypto.randomUUID();
  const requestedAt = params.requestedAt ?? new Date();
  const [res] = await connexion.execute<ResultSetHeader>(
    `INSERT INTO \`AccountDeletionFeedback\`
      (id, user_id, token_hash, requested_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, params.userId, params.tokenHash, requestedAt, params.expiresAt],
  );
  return res.affectedRows === 1 ? id : null;
}

export async function submitAccountDeletionFeedbackByTokenHash(params: {
  tokenHash: string;
  reasonsJson: string | null;
  otherText: string | null;
  userAgent: string | null;
  submittedIpHash: string | null;
  submittedAt?: Date;
}) {
  const connexion = await getDb();
  const submittedAt = params.submittedAt ?? new Date();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE \`AccountDeletionFeedback\`
     SET reasons_json = ?, other_text = ?, user_agent = ?, submitted_ip_hash = ?, submitted_at = ?
     WHERE token_hash = ?
       AND submitted_at IS NULL
       AND expires_at > ?`,
    [
      params.reasonsJson,
      params.otherText,
      params.userAgent,
      params.submittedIpHash,
      submittedAt,
      params.tokenHash,
      submittedAt,
    ],
  );
  return res.affectedRows === 1;
}

export async function anonymizeUserCredentials(params: {
  userId: ID;
  anonymizedEmail: string;
  passwordHash: string;
}) {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE \`User\`
     SET email = ?, password_hash = ?
     WHERE id = ?`,
    [params.anonymizedEmail, params.passwordHash, params.userId],
  );
  return res.affectedRows === 1;
}

export async function deleteUser(userId: ID) {
  // FK Subscription ON DELETE CASCADE supprime l'historique automatiquement
  /**
   * SQL: DELETE FROM User WHERE id = ?
   */
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM \`User\` WHERE id = ?`,
    [userId],
  );
  return res.affectedRows === 1;
}

// ===================================================================
// Customer â€” CRUD
// ===================================================================
type CustomerWritableFields = Pick<
  Customer,
  | "email"
  | "first_name"
  | "last_name"
  | "address_line1"
  | "address_line2"
  | "postal_code"
  | "city"
  | "country"
  | "phone"
  | "stripe_customer_id"
  | "total_spent_cents"
>;

export async function createCustomer(params: {
  user_id: ID;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  stripe_customer_id?: string | null;
  total_spent_cents?: number;
  id?: ID;
}) {
  const connexion = await getDb();
  const id = params.id ?? crypto.randomUUID();
  const sql = `INSERT INTO Customer (
      id,
      user_id,
      email,
      first_name,
      last_name,
      address_line1,
      address_line2,
      postal_code,
      city,
      country,
      phone,
      stripe_customer_id,
      total_spent_cents
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = [
    id,
    params.user_id,
    params.email,
    params.first_name ?? null,
    params.last_name ?? null,
    params.address_line1 ?? null,
    params.address_line2 ?? null,
    params.postal_code ?? null,
    params.city ?? null,
    params.country ?? null,
    params.phone ?? null,
    params.stripe_customer_id ?? null,
    params.total_spent_cents ?? 0,
  ];
  const [res] = await connexion.execute<ResultSetHeader>(sql, values);
  return res.affectedRows === 1 ? id : null;
}

export async function getCustomerById(
  customerId: ID,
): Promise<Customer | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<Customer[]>(
    `SELECT * FROM Customer WHERE id = ? LIMIT 1`,
    [customerId],
  );
  return rows[0] ?? null;
}

export async function getCustomerByUserId(
  userId: ID,
): Promise<Customer | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<Customer[]>(
    `SELECT * FROM Customer WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function getCustomerByStripeCustomerId(
  stripeCustomerId: string,
): Promise<Customer | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<Customer[]>(
    `SELECT * FROM Customer WHERE stripe_customer_id = ? LIMIT 1`,
    [stripeCustomerId],
  );
  return rows[0] ?? null;
}

export async function listCustomers(
  limit = 50,
  offset = 0,
): Promise<Customer[]> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<Customer[]>(
    `SELECT * FROM Customer ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows;
}

export async function updateCustomer(
  customerId: ID,
  fields: Partial<CustomerWritableFields>,
) {
  const connexion = await getDb();
  const sets: string[] = [];
  const values: any[] = [];

  if (fields.email !== undefined) {
    sets.push(`email = ?`);
    values.push(fields.email);
  }
  if (fields.first_name !== undefined) {
    sets.push(`first_name = ?`);
    values.push(fields.first_name);
  }
  if (fields.last_name !== undefined) {
    sets.push(`last_name = ?`);
    values.push(fields.last_name);
  }
  if (fields.address_line1 !== undefined) {
    sets.push(`address_line1 = ?`);
    values.push(fields.address_line1);
  }
  if (fields.address_line2 !== undefined) {
    sets.push(`address_line2 = ?`);
    values.push(fields.address_line2);
  }
  if (fields.postal_code !== undefined) {
    sets.push(`postal_code = ?`);
    values.push(fields.postal_code);
  }
  if (fields.city !== undefined) {
    sets.push(`city = ?`);
    values.push(fields.city);
  }
  if (fields.country !== undefined) {
    sets.push(`country = ?`);
    values.push(fields.country);
  }
  if (fields.phone !== undefined) {
    sets.push(`phone = ?`);
    values.push(fields.phone);
  }
  if (fields.stripe_customer_id !== undefined) {
    sets.push(`stripe_customer_id = ?`);
    values.push(fields.stripe_customer_id);
  }
  if (fields.total_spent_cents !== undefined) {
    sets.push(`total_spent_cents = ?`);
    values.push(fields.total_spent_cents);
  }

  if (sets.length === 0) return false;

  const sql = `UPDATE Customer SET ${sets.join(", ")} WHERE id = ?`;
  values.push(customerId);
  const [res] = await connexion.execute<ResultSetHeader>(sql, values);
  return res.affectedRows === 1;
}

export async function deleteCustomer(customerId: ID) {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM Customer WHERE id = ?`,
    [customerId],
  );
  return res.affectedRows === 1;
}

// ===================================================================
// Stripe checkout session state helpers
// ===================================================================

export async function createStripeCheckoutSessionState(params: {
  sessionId: string;
  email: string;
  planCode: string;
  planId?: ID | null;
  currencyCode?: string;
}): Promise<ID | null> {
  const connexion = await getDb();
  const id = crypto.randomUUID();
  // Important: do NOT downgrade an existing record (completed/failed) back to pending.
  // This state is our source of truth for provisioning status.
  const sql = `INSERT INTO StripeCheckoutSession (id, session_id, email, plan_code, plan_id, currency_code, status)
               VALUES (?, ?, ?, ?, ?, ?, 'pending')
               ON DUPLICATE KEY UPDATE
                 email = VALUES(email),
                 plan_code = VALUES(plan_code),
                 plan_id = VALUES(plan_id),
                 currency_code = VALUES(currency_code),
                 last_error = CASE WHEN status = 'pending' THEN NULL ELSE last_error END,
                 status = status`;
  const [res] = await connexion.execute<ResultSetHeader>(sql, [
    id,
    params.sessionId,
    params.email,
    params.planCode,
    params.planId ?? null,
    params.currencyCode ?? "CHF",
  ]);
  return res.affectedRows >= 1 ? id : null;
}

export async function markStripeCheckoutSessionLastError(
  sessionId: string,
  errorMessage: string,
) {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE StripeCheckoutSession
       SET last_error = ?
     WHERE session_id = ?`,
    [errorMessage, sessionId],
  );
  return res.affectedRows >= 1;
}

export async function getStripeCheckoutSessionState(
  sessionId: string,
): Promise<StripeCheckoutSessionState | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<StripeCheckoutSessionState[]>(
    `SELECT * FROM StripeCheckoutSession WHERE session_id = ? LIMIT 1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function markStripeCheckoutSessionCompleted(
  sessionId: string,
  params: {
    userId?: ID | null;
    subscriptionId?: ID | null;
    planId?: ID | null;
  },
) {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE StripeCheckoutSession
       SET status = 'completed',
           user_id = COALESCE(?, user_id),
           subscription_id = COALESCE(?, subscription_id),
           plan_id = COALESCE(?, plan_id),
           last_error = NULL
     WHERE session_id = ?`,
    [
      params.userId ?? null,
      params.subscriptionId ?? null,
      params.planId ?? null,
      sessionId,
    ],
  );
  return res.affectedRows >= 1;
}

export async function markStripeCheckoutSessionFailed(
  sessionId: string,
  errorMessage: string,
) {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE StripeCheckoutSession
       SET status = 'failed',
           last_error = ?
     WHERE session_id = ?`,
    [errorMessage, sessionId],
  );
  return res.affectedRows >= 1;
}

export async function markStripeCheckoutSessionConsumed(sessionId: string) {
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE StripeCheckoutSession
       SET consumed_at = NOW()
     WHERE session_id = ? AND consumed_at IS NULL`,
    [sessionId],
  );
  return res.affectedRows >= 1;
}

// ===================================================================
// PLANS â€” CRUD & seed helpers (new schema)
// ===================================================================
/**
 * Create a minimal plan (legacy signature).
 * Only uses name + price. Other fields get defaults.
 */
export async function createPlan(name: string, price: number, id?: ID) {
  const connexion = await getDb();
  const theId = id ?? crypto.randomUUID();
  const sql = `INSERT INTO Plan (id, code, name, price, currency_code, billing_interval, daily_credit_quota, is_archived)
               VALUES (?, LOWER(REPLACE(?, ' ', '_')), ?, ?, 'CHF', 'month', 0, 0)`;
  // code is derived from name by default (e.g., 'Pro Plan' -> 'pro_plan')
  const [res] = await connexion.execute<ResultSetHeader>(sql, [
    theId,
    name,
    name,
    price,
  ]);
  return res.affectedRows === 1 ? theId : null;
}

/**
 * Fetch one plan by primary key.
 * SQL: SELECT * FROM Plan WHERE id = ? LIMIT 1
 */
export async function getPlanById(planId: ID): Promise<Plan | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE id = ? LIMIT 1`,
    [planId],
  );
  return rows[0] ?? null;
}

/**
 * Fetch one plan by unique name.
 * SQL: SELECT * FROM Plan WHERE name = ? LIMIT 1
 */
export async function getPlanByName(name: string): Promise<Plan | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE name = ? LIMIT 1`,
    [name],
  );
  return rows[0] ?? null;
}

/**
 * Find a plan by code (e.g., 'free','hobby','pro').
 */
export async function getPlanByCode(code: string): Promise<Plan | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE code = ? LIMIT 1`,
    [code],
  );
  return rows[0] ?? null;
}

export async function getPlanByStripePriceId(
  stripePriceId: string,
): Promise<Plan | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<Plan[]>(
    `SELECT * FROM Plan WHERE stripe_price_id = ? LIMIT 1`,
    [stripePriceId],
  );
  return rows[0] ?? null;
}

export async function listPlans(includeArchived = false): Promise<Plan[]> {
  /**
   * SQL: SELECT * FROM Plan [WHERE is_archived=0] ORDER BY created_at DESC
   */
  const connexion = await getDb();
  const sql = includeArchived
    ? `SELECT * FROM Plan ORDER BY created_at DESC`
    : `SELECT * FROM Plan WHERE is_archived = 0 ORDER BY created_at DESC`;
  const [rows] = await connexion.query<Plan[]>(sql);
  return rows;
}

export async function updatePlan(
  planId: ID,
  fields: Partial<
    Pick<
      Plan,
      | "name"
      | "price"
      | "currency_code"
      | "billing_interval"
      | "daily_credit_quota"
      | "stripe_price_id"
    >
  >,
) {
  /**
   * SQL (dynamic SET): UPDATE Plan SET ... WHERE id = ?
   */
  const connexion = await getDb();
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
  if (fields.currency_code !== undefined) {
    sets.push(`currency_code = ?`);
    values.push(fields.currency_code);
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
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `UPDATE Plan SET is_archived = ? WHERE id = ?`,
    [archived ? 1 : 0, planId],
  );
  return res.affectedRows === 1;
}

export async function deletePlan(planId: ID) {
  // Attention: FK Subscription ON DELETE RESTRICT peut empÃªcher la suppression
  /**
   * SQL: DELETE FROM Plan WHERE id = ?
   */
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM Plan WHERE id = ?`,
    [planId],
  );
  return res.affectedRows === 1;
}

// ------------------------------------------------------
// PLANS â€” Seed helpers
// ------------------------------------------------------
/**
 * Ensure a plan exists by code; insert or update with provided attributes.
 * Returns the plan id.
 */
export async function upsertPlanByCode(input: {
  code: string;
  name: string;
  price: number;
  currency_code?: string;
  billing_interval?: "day" | "week" | "month" | "year";
  daily_credit_quota?: number;
  stripe_price_id?: string | null;
}): Promise<ID> {
  const connexion = await getDb();
  const existing = await getPlanByCode(input.code);
  if (!existing) {
    const id = crypto.randomUUID();
    const sql = `INSERT INTO Plan (id, code, name, price, currency_code, billing_interval, daily_credit_quota, stripe_price_id, is_archived)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`;
    const params = [
      id,
      input.code,
      input.name,
      input.price,
      input.currency_code ?? "CHF",
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
      currency_code: input.currency_code ?? existing.currency_code,
      billing_interval: input.billing_interval ?? existing.billing_interval,
      daily_credit_quota:
        input.daily_credit_quota ?? existing.daily_credit_quota,
      stripe_price_id:
        input.stripe_price_id ?? existing.stripe_price_id ?? undefined,
    });
    return existing.id;
  }
}

/**
 * Seed default plans (adjust values as needed).
 * - free: price 0, 10 credits/day
 * - hobby: 9.99â‚¬, 100 credits/day
 * - pro: 29.99â‚¬, 1000 credits/day
 */
export async function seedDefaultPlans() {
  await upsertPlanByCode({
    code: "free",
    name: "Free",
    price: 0,
    currency_code: "CHF",
    billing_interval: "month",
    daily_credit_quota: 10,
  });
  await upsertPlanByCode({
    code: "hobby",
    name: "Hobby",
    price: 500,
    currency_code: "CHF",
    billing_interval: "month",
    daily_credit_quota: 100,
  });
  await upsertPlanByCode({
    code: "pro",
    name: "Pro",
    price: 1500,
    currency_code: "CHF",
    billing_interval: "month",
    daily_credit_quota: 1000,
  });
}

// ===================================================================
// SUBSCRIPTIONS â€” CRUD & logique d'affaires
// ===================================================================
/**
 * Fetch the active subscription for a user with plan details (name, price).
 * SQL: SELECT s.*, p.name AS plan_name, p.price AS plan_price FROM Subscription s JOIN Plan p ON p.id=s.plan_id WHERE s.user_id=? AND s.is_active=TRUE LIMIT 1
 */
export async function getActiveSubscription(
  userId: ID,
): Promise<(Subscription & { plan_name: string; plan_price: number }) | null> {
  const connexion = await getDb();
  // Active subscription with joined plan info (name, price)
  const [rows] = await connexion.execute<any[]>(
    `
    SELECT s.*, p.name AS plan_name, p.price AS plan_price
    FROM Subscription s
    JOIN Plan p ON p.id = s.plan_id
    WHERE s.user_id = ? AND s.is_active = TRUE
    LIMIT 1
    `,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * List all subscriptions for a user with joined plan name, most recent first.
 * SQL: SELECT s.*, p.name AS plan_name FROM Subscription s JOIN Plan p ON p.id=s.plan_id WHERE s.user_id=? ORDER BY s.period_start DESC
 */
export async function listUserubscriptions(
  userId: ID,
): Promise<(Subscription & { plan_name: string })[]> {
  const connexion = await getDb();
  // History of subscriptions for a user, most recent first
  const [rows] = await connexion.execute<any[]>(
    `
    SELECT s.*, p.name AS plan_name
    FROM Subscription s
    JOIN Plan p ON p.id = s.plan_id
    WHERE s.user_id = ?
    ORDER BY s.period_start DESC
    `,
    [userId],
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
 * CrÃ©e une subscription.
 * âš ï¸ Si isActive=true, il faut que l'index UNIQUE(user_id, is_active) soit en place
 * et qu'aucune autre ligne active n'existe (sinon erreur SQL).
 * Utilise switchPlan() pour gÃ©rer proprement le passage d'un plan Ã  l'autre.
 */
export async function createSubscription(input: CreateSubscriptionInput) {
  const connexion = await getDb();
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
  subId: ID,
): Promise<Subscription | null> {
  /**
   * SQL: SELECT * FROM Subscription WHERE id = ? LIMIT 1
   */
  const connexion = await getDb();
  const [rows] = await connexion.execute<Subscription[]>(
    `SELECT * FROM Subscription WHERE id = ? LIMIT 1`,
    [subId],
  );
  return rows[0] ?? null;
}

export async function updateSubscription(
  subId: ID,
  fields: Partial<
    Pick<
      Subscription,
      | "status"
      | "is_active"
      | "period_start"
      | "period_end"
      | "plan_id"
      | "stripe_subscription_id"
      | "stripe_customer_id"
      | "cancel_at"
      | "canceled_at"
      | "stripe_cancel_at_period_end"
      | "current_period_end"
      | "plan_access_until"
      | "pending_plan_id"
      | "pending_change_type"
      | "pending_change_effective_at"
      | "stripe_schedule_id"
      | "credit_initial"
      | "credit_used"
    >
  >,
) {
  /**
   * SQL (dynamic SET): UPDATE Subscription SET ... WHERE id = ?
   */
  const connexion = await getDb();
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
  if (fields.stripe_cancel_at_period_end !== undefined) {
    sets.push(`stripe_cancel_at_period_end = ?`);
    values.push(fields.stripe_cancel_at_period_end);
  }
  if (fields.current_period_end !== undefined) {
    sets.push(`current_period_end = ?`);
    values.push(fields.current_period_end);
  }
  if (fields.plan_access_until !== undefined) {
    sets.push(`plan_access_until = ?`);
    values.push(fields.plan_access_until);
  }
  if (fields.pending_plan_id !== undefined) {
    sets.push(`pending_plan_id = ?`);
    values.push(fields.pending_plan_id);
  }
  if (fields.pending_change_type !== undefined) {
    sets.push(`pending_change_type = ?`);
    values.push(fields.pending_change_type);
  }
  if (fields.pending_change_effective_at !== undefined) {
    sets.push(`pending_change_effective_at = ?`);
    values.push(fields.pending_change_effective_at);
  }
  if (fields.stripe_schedule_id !== undefined) {
    sets.push(`stripe_schedule_id = ?`);
    values.push(fields.stripe_schedule_id);
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
  const connexion = await getDb();
  const [res] = await connexion.execute<ResultSetHeader>(
    `DELETE FROM Subscription WHERE id = ?`,
    [subId],
  );
  return res.affectedRows === 1;
}

// -------------------------------------------------------------------
// Logique : CANCEL l'abonnement actif (si prÃ©sent)
// -------------------------------------------------------------------
export async function cancelActiveSubscription(
  userId: ID,
  at: Date = new Date(),
) {
  return withTransaction(async (cx) => {
    const [rows] = await cx.execute<Subscription[]>(
      `SELECT * FROM Subscription WHERE user_id = ? AND is_active = TRUE LIMIT 1`,
      [userId],
    );
    const current = rows[0];
    if (!current) return false;

    const [res] = await cx.execute<ResultSetHeader>(
      `UPDATE Subscription SET status = 'canceled', is_active = NULL, period_end = ?, canceled_at = ? WHERE id = ?`,
      [at, at, current.id],
    );
    return res.affectedRows === 1;
  });
}

// -------------------------------------------------------------------
// Logique : SWITCH / UPGRADE de plan (transaction atomique)
// - ClÃ´ture l'actif courant (si existe)
// - CrÃ©e une nouvelle subscription active pour le nouveau plan
// - Respecte l'unicitÃ© (user_id, is_active)
// -------------------------------------------------------------------
export async function switchPlan(
  userId: ID,
  newPlanId: ID,
  now: Date = new Date(),
) {
  return withTransaction(async (cx) => {
    // 1) DÃ©sactiver l'actuel (s'il existe)
    const [rows] = await cx.execute<Subscription[]>(
      `SELECT * FROM Subscription WHERE user_id = ? AND is_active = TRUE LIMIT 1`,
      [userId],
    );
    const current = rows[0];
    if (current) {
      await cx.execute(
        `UPDATE Subscription SET status = 'canceled', is_active = NULL, period_end = ?, canceled_at = ? WHERE id = ?`,
        [now, now, current.id],
      );
    }

    // 2) CrÃ©er le nouveau actif (pÃ©riode par dÃ©faut : 30 jours)
    const periodEnd = addDays(now, 30);
    const newId = crypto.randomUUID();
    await cx.execute(
      `
      INSERT INTO Subscription
        (id, user_id, plan_id, status, is_active, period_start, period_end)
      VALUES (?, ?, ?, 'active', TRUE, ?, ?)
      `,
      [newId, userId, newPlanId, now, periodEnd],
    );

    return newId;
  });
}

// -------------------------------------------------------------------
// Logique : RENEW (prolonge la pÃ©riode d'un actif)
// -------------------------------------------------------------------
export async function renewActiveSubscription(userId: ID, extraDays = 30) {
  return withTransaction(async (cx) => {
    const [rows] = await cx.execute<Subscription[]>(
      `SELECT * FROM Subscription WHERE user_id = ? AND is_active = TRUE LIMIT 1`,
      [userId],
    );
    const current = rows[0];
    if (!current) throw new Error("Aucun abonnement actif");

    const newEnd = addDays(new Date(current.period_end), extraDays);
    const [res] = await cx.execute<ResultSetHeader>(
      `UPDATE Subscription SET period_end = ? WHERE id = ?`,
      [newEnd, current.id],
    );
    return res.affectedRows === 1;
  });
}

// -------------------------------------------------------------------
// Logique : Activer une subscription spÃ©cifique (et dÃ©sactiver l'actuelle)
// -------------------------------------------------------------------
export async function activateSubscription(
  userId: ID,
  subscriptionId: ID,
  now: Date = new Date(),
) {
  return withTransaction(async (cx) => {
    // DÃ©sactiver l'actuelle
    await cx.execute(
      `UPDATE Subscription SET status = 'canceled', is_active = NULL, period_end = ? WHERE user_id = ? AND is_active = TRUE`,
      [now, userId],
    );
    // Activer la ciblÃ©e
    const [res] = await cx.execute<ResultSetHeader>(
      `UPDATE Subscription SET status = 'active', is_active = TRUE, period_start = ? WHERE id = ? AND user_id = ?`,
      [now, subscriptionId, userId],
    );
    return res.affectedRows === 1;
  });
}

// ===================================================================
// Credit usage â€” helpers (ledger + 24h window)
// ===================================================================
/**
 * Record a credit usage event for a subscription.
 * Use requestId to make the operation idempotent per external request.
 */
export async function recordCreditUsage(
  subscriptionId: ID,
  used = 1,
  reason: string = "api_call",
  requestId?: string,
) {
  const connexion = await getDb();
  const id = crypto.randomUUID();
  const sql = `INSERT INTO \`CreditUsage\` (id, subscription_id, used, reason, request_id)
               VALUES (?, ?, ?, ?, ?)`;
  try {
    const [res] = await connexion.execute<ResultSetHeader>(sql, [
      id,
      subscriptionId,
      used,
      reason,
      requestId ?? null,
    ]);
    // Extra debug: helps validate which DB/schema this code is actually writing to.
    try {
      const [dbRows] = await connexion.query<RowDataPacket[]>(
        `SELECT DATABASE() AS db`,
      );
      const currentDb = (dbRows[0] as any)?.db ?? null;
      console.log("[recordCreditUsage] insert ok", {
        id,
        subscriptionId,
        used,
        reason,
        requestId: requestId ?? null,
        db: currentDb,
      });
    } catch {}
    return res.affectedRows === 1 ? id : null;
  } catch (err: any) {
    // Idempotency: if we already recorded this request_id, return existing row id.
    if (requestId && err && err.code === "ER_DUP_ENTRY") {
      const [rows] = await connexion.execute<RowDataPacket[]>(
        `SELECT id FROM \`CreditUsage\` WHERE request_id = ? LIMIT 1`,
        [requestId],
      );
      const existingId = rows[0] ? String((rows[0] as any).id) : null;
      return existingId;
    }
    // Make this extremely visible during MVP hardening.
    console.error("[recordCreditUsage] insert failed", {
      subscriptionId,
      used,
      reason,
      requestId: requestId ?? null,
      message: err?.message || String(err),
      code: err?.code,
      errno: err?.errno,
      sqlState: err?.sqlState,
    });
    throw err;
  }
}

/**
 * Get usage and remaining credits over the last 24h for the active subscription of a user.
 * Relies on the SQL view v_subscription_usage_24h.
 */
export async function getActiveUsage24h(
  userId: ID,
): Promise<SubscriptionUsage24h | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<SubscriptionUsage24h[]>(
    `SELECT * FROM v_subscription_usage_24h WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

/**
 * Get usage and remaining credits for the CURRENT billing period (monthly).
 * - For Stripe subscriptions, period_start/period_end must be kept in sync by Stripe webhooks.
 * - For "free" subscriptions (no Stripe), we auto-roll the period forward when it expires.
 *
 * Note: We keep Plan.daily_credit_quota as the stored quota field to avoid DB migrations,
 * but it now represents the quota per billing period ("month") for this MVP.
 */
export async function getActiveUsageBillingPeriod(
  userId: ID,
  now: Date = new Date(),
): Promise<SubscriptionUsageBillingPeriod | null> {
  const connexion = await getDb();

  const user = await getUserById(userId);
  const accountDeletionRequested = user
    ? user.account_deletion_requested === 1
    : false;

  // Load active subscription first (we may need to roll the period forward).
  const [subs] = await connexion.execute<Subscription[]>(
    `SELECT * FROM Subscription WHERE user_id = ? AND is_active = TRUE LIMIT 1`,
    [userId],
  );
  const sub = subs[0];
  if (!sub) return null;

  const hasStripe = Boolean(sub.stripe_subscription_id);
  if (hasStripe) {
    const allowed = isPremiumAccessAllowed({
      subscriptionStatus: sub.status,
      accountDeletionRequested,
      planAccessUntil: sub.plan_access_until
        ? new Date(sub.plan_access_until)
        : null,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end)
        : null,
      periodEnd: new Date(sub.period_end),
      now,
    });
    if (!allowed) return null;
  }
  const subPeriodEnd = new Date(sub.period_end);
  if (!hasStripe && subPeriodEnd.getTime() <= now.getTime()) {
    // Free plan: roll forward by whole months until the current time is inside [start, end).
    // This avoids users getting stuck with an expired period and never seeing credits renew.
    let newStart = new Date(sub.period_start);
    let newEnd = new Date(sub.period_end);
    let safety = 0;
    while (newEnd.getTime() <= now.getTime() && safety < 24) {
      newStart = newEnd;
      newEnd = addMonthsKeepingDay(newEnd, 1);
      safety += 1;
    }
    await connexion.execute<ResultSetHeader>(
      `UPDATE Subscription SET period_start = ?, period_end = ? WHERE id = ?`,
      [newStart, newEnd, sub.id],
    );
  }

  const sql = `
    SELECT
      s.id AS subscription_id,
      s.user_id,
      s.plan_id,
      s.period_start,
      s.period_end,
      p.daily_credit_quota,
      COALESCE(SUM(cu.used), 0) AS used_in_period,
      GREATEST(p.daily_credit_quota - COALESCE(SUM(cu.used), 0), 0) AS remaining_in_period
    FROM Subscription s
    JOIN Plan p ON p.id = s.plan_id
    LEFT JOIN CreditUsage cu
      ON cu.subscription_id = s.id
      AND cu.occurred_at >= s.period_start
      AND cu.occurred_at < s.period_end
    WHERE s.user_id = ? AND s.is_active = TRUE
    GROUP BY s.id, s.user_id, s.plan_id, s.period_start, s.period_end, p.daily_credit_quota
    LIMIT 1
  `;
  const [rows] = await connexion.execute<SubscriptionUsageBillingPeriod[]>(
    sql,
    [userId],
  );
  return rows[0] ?? null;
}

// ------------------------------------------------------
// Plan + crÃ©dits restants sur 24h (par utilisateur)
// ------------------------------------------------------
export interface UserPlanAndCreditsRow extends RowDataPacket {
  plan_code: string;
  remaining_last_24h: number;
}

/**
 * Retourne le type de plan (code: 'free' | 'hobby' | 'pro', etc.)
 * et le nombre de crÃ©dits restants sur 24h pour l'utilisateur donnÃ©.
 * S'appuie sur la vue `v_subscription_usage_24h` et la table `Plan`.
 */
export async function getUserPlanAndCredits24h(
  userId: ID,
): Promise<{ plan: string; remaining_credits_24h: number } | null> {
  const connexion = await getDb();
  try {
    const [rows] = await connexion.execute<UserPlanAndCreditsRow[]>(
      `SELECT plan_code, remaining_last_24h FROM v_subscription_usage_24h WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      plan: row.plan_code,
      remaining_credits_24h: row.remaining_last_24h,
    };
  } catch (err: any) {
    // Fallback for environments where the view doesn't expose plan_code yet
    if (
      err &&
      (err.code === "ER_BAD_FIELD_ERROR" ||
        String(err.message || "").includes("plan_code"))
    ) {
      const [rows] = await connexion.execute<RowDataPacket[]>(
        `SELECT p.code AS plan_code, v.remaining_last_24h
         FROM v_subscription_usage_24h v
         JOIN Plan p ON p.id = v.plan_id
         WHERE v.user_id = ?
         LIMIT 1`,
        [userId],
      );
      const row: any = rows[0];
      if (!row) return null;
      return {
        plan: String(row.plan_code),
        remaining_credits_24h: Number(row.remaining_last_24h),
      };
    }
    throw err;
  }
}

// -------------------------------------------------------------------
// Plan + crÃ©dits restants sur la pÃ©riode de facturation (mensuelle)
// -------------------------------------------------------------------
export async function getUserPlanAndCreditsBillingPeriod(
  userId: ID,
): Promise<{ plan: string; remaining_credits_in_period: number } | null> {
  const usage = await getActiveUsageBillingPeriod(userId);
  if (!usage) return null;

  const connexion = await getDb();
  const [rows] = await connexion.execute<RowDataPacket[]>(
    `SELECT p.code AS plan_code
     FROM Subscription s
     JOIN Plan p ON p.id = s.plan_id
     WHERE s.user_id = ? AND s.is_active = TRUE
     LIMIT 1`,
    [userId],
  );
  const planCode = rows[0] ? String((rows[0] as any).plan_code) : "";
  if (!planCode) return null;

  return {
    plan: planCode,
    remaining_credits_in_period: usage.remaining_in_period,
  };
}

// --------------------------------------
// Active plan code (lightweight lookup)
// --------------------------------------
export async function getActivePlanCodeForUser(userId: ID): Promise<string | null> {
  const connexion = await getDb();
  const [rows] = await connexion.execute<RowDataPacket[]>(
    `SELECT p.code AS plan_code
     FROM Subscription s
     JOIN Plan p ON p.id = s.plan_id
     WHERE s.user_id = ? AND s.is_active = TRUE
     LIMIT 1`,
    [userId],
  );
  const planCode = rows[0] ? String((rows[0] as any).plan_code || "") : "";
  return planCode || null;
}
