import crypto from "node:crypto";
import type Stripe from "stripe";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

import { connectDb } from "../../DB/poolConnexion/poolConnexion.ts";
import {
  createStripeCheckoutSessionState,
  createSubscription,
  createUser,
  getPlanByCode,
  getStripeCheckoutSessionState,
  getUserByEmail,
  markStripeCheckoutSessionCompleted,
  type StripeCheckoutSessionState,
  updateSubscription,
  upsertPlanByCode,
} from "../../DB/queriesSQL/queriesSQL.ts";
import { planOption } from "../../data/planOption.ts";
import { logger } from "../../logger.ts";
import { notifyNewClientSignup, safeNotify } from "../../utils/telegramNotification.ts";

export class CheckoutSessionPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutSessionPendingError";
  }
}

const resolveEmailFromSession = (session: Stripe.Checkout.Session): string | null => {
  const fromDetails = session.customer_details?.email;
  if (fromDetails) return fromDetails.toLowerCase();
  if (session.customer_email) return session.customer_email.toLowerCase();
  if (typeof session.customer === "object" && session.customer && "email" in session.customer) {
    const email = (session.customer as Stripe.Customer).email;
    if (email) return email.toLowerCase();
  }
  if (session.metadata?.email) return String(session.metadata.email).toLowerCase();
  return null;
};

const resolvePlanCodeFromSession = (session: Stripe.Checkout.Session): string | null => {
  const raw = session.metadata?.plan_code ?? (session.metadata as any)?.planCode;
  if (!raw) return null;
  return String(raw).toLowerCase();
};

const resolveStripeCustomerId = (session: Stripe.Checkout.Session): string | null => {
  if (typeof session.customer === "string") return session.customer;
  if (session.customer && "id" in session.customer) {
    return (session.customer as Stripe.Customer).id;
  }
  return null;
};

const resolveStripeSubscriptionId = (session: Stripe.Checkout.Session): string | null => {
  if (!session.subscription) return null;
  if (typeof session.subscription === "string") return session.subscription;
  return (session.subscription as Stripe.Subscription).id ?? null;
};

export type FinalizeCheckoutSessionInput = {
  session: Stripe.Checkout.Session;
  referer?: string | null;
};

export const finalizeCheckoutSessionFromStripeSession = async ({
  session,
  referer = null,
}: FinalizeCheckoutSessionInput): Promise<StripeCheckoutSessionState> => {
  const sessionId = session.id;
  const email = resolveEmailFromSession(session);
  const planCode = resolvePlanCodeFromSession(session);
  const stripeCustomerId = resolveStripeCustomerId(session);
  const stripeSubscriptionId = resolveStripeSubscriptionId(session);
  const customerDetails = session.customer_details || null;

  if (!sessionId || !email || !planCode) {
    throw new CheckoutSessionPendingError("Checkout session missing email or plan metadata");
  }

  let state = await getStripeCheckoutSessionState(sessionId);
  if (!state) {
    await createStripeCheckoutSessionState({
      sessionId,
      email,
      planCode,
      currencyCode: session.currency ? String(session.currency).toUpperCase() : "CHF",
    });
    state = await getStripeCheckoutSessionState(sessionId);
  }

  if (!state) {
    throw new Error("Unable to persist Stripe checkout session state");
  }

  if (state.status === "completed" && state.user_id) {
    return state;
  }

  let plan = await getPlanByCode(planCode);
  if (!plan) {
    const planConfig = planOption.find((config) => config.name === planCode);
    if (!planConfig) {
      throw new CheckoutSessionPendingError(`Unknown plan code ${planCode}`);
    }
    const basePrice =
      planConfig.prices?.CHF ??
      planConfig.price ??
      planConfig.prices?.EUR ??
      planConfig.prices?.USD ??
      0;
    const storedPrice = Number.isFinite(basePrice)
      ? Math.round(Number(basePrice) * 100)
      : 0;
    try {
      await upsertPlanByCode({
        code: planConfig.name,
        name: planConfig.name,
        price: storedPrice,
        currency_code: "CHF",
        billing_interval: "month",
        daily_credit_quota: planConfig.credit ?? 0,
      });
    } catch (err) {
      logger.error("[stripe] Failed to seed plan", planCode, err);
      throw new CheckoutSessionPendingError(`Unable to provision plan ${planCode}`);
    }
    plan = await getPlanByCode(planCode);
  }

  if (!plan) {
    throw new CheckoutSessionPendingError(`Plan ${planCode} unavailable`);
  }

  const pool = await connectDb();
  const normalizedEmail = email.toLowerCase();
  let user = await getUserByEmail(normalizedEmail);

  if (!user) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT password_hash FROM EmailVerification WHERE email = ? AND account = 0 AND consumed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail]
    );
    const hash = (rows[0] as any)?.password_hash as string | undefined;
    if (!hash) {
      throw new CheckoutSessionPendingError(`Missing password hash for ${normalizedEmail}`);
    }
    const newId = await createUser(normalizedEmail, hash);
    if (!newId) {
      throw new CheckoutSessionPendingError(`Failed to create user ${normalizedEmail}`);
    }
    user = await getUserByEmail(normalizedEmail);
    await pool.execute<ResultSetHeader>(
      `UPDATE EmailVerification SET account = 1 WHERE email = ? AND account = 0 AND consumed_at IS NOT NULL`,
      [normalizedEmail]
    );
  }

  if (!user) {
    throw new Error(`User lookup failed for ${normalizedEmail}`);
  }

  if (customerDetails || stripeCustomerId) {
    try {
      const fullName = customerDetails?.name || "";
      const [firstName, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
      const lastName = rest.join(" ") || null;
      const addr = customerDetails?.address || {};
      const phone: string | null = customerDetails?.phone || null;
      const id = crypto.randomUUID();
      await pool.execute<ResultSetHeader>(
        `INSERT INTO Customer (id, user_id, email, first_name, last_name, address_line1, address_line2, postal_code, city, country, phone, stripe_customer_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           user_id=VALUES(user_id),
           email=VALUES(email),
           first_name=VALUES(first_name),
           last_name=VALUES(last_name),
           address_line1=VALUES(address_line1),
           address_line2=VALUES(address_line2),
           postal_code=VALUES(postal_code),
           city=VALUES(city),
           country=VALUES(country),
           phone=VALUES(phone),
           stripe_customer_id=VALUES(stripe_customer_id)`,
        [
          id,
          user.id,
          normalizedEmail,
          firstName || null,
          lastName,
          addr?.line1 || null,
          addr?.line2 || null,
          addr?.postal_code || null,
          addr?.city || null,
          addr?.country || null,
          phone,
          stripeCustomerId,
        ]
      );
    } catch (err) {
      logger.warn(
        `[stripe] Failed to upsert customer profile for ${normalizedEmail}: ${(err as any)?.message || err}`
      );
    }
  }

  let subscriptionId = state.subscription_id ?? null;
  if (!subscriptionId) {
    subscriptionId = await createSubscription({
      userId: user.id,
      planId: plan.id,
      isActive: true,
    });
  }

  if (subscriptionId && (stripeSubscriptionId || stripeCustomerId)) {
    await updateSubscription(subscriptionId, {
      stripe_subscription_id: stripeSubscriptionId ?? undefined,
      stripe_customer_id: stripeCustomerId ?? undefined,
    } as any);
  }

  await markStripeCheckoutSessionCompleted(sessionId, {
    userId: user.id,
    subscriptionId,
    planId: plan.id,
  });

  await safeNotify(() =>
    notifyNewClientSignup({
      email: normalizedEmail,
      planCode,
      referer,
    })
  );

  const refreshedState = await getStripeCheckoutSessionState(sessionId);
  if (!refreshedState) {
    throw new Error("Stripe checkout session state unavailable after completion");
  }
  return refreshedState;
};
