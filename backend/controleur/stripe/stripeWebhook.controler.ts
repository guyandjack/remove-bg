import type { RequestHandler } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { connectDb } from "../../DB/poolConnexion/poolConnexion.ts";
import {
  getPlanByCode,
  getUserByEmail,
  createUser,
  createSubscription,
  updateSubscription,
  markStripeCheckoutSessionCompleted,
  markStripeCheckoutSessionFailed,
  upsertPlanByCode,
} from "../../DB/queriesSQL/queriesSQL.ts";
import { planOption } from "../../data/planOption.ts";
import { logger } from "../../logger.ts";


// Stripe webhook to finalize paid signups and activate subscriptions
// Handles: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted
// Note: For signature verification, ensure your server uses raw body middleware for this route


const stripeWebhook: RequestHandler = async (req, res) => {
  let currentCheckoutSessionId: string | null = null;
  try {
    const isProd =
      process.env.NODE_ENV === "production" &&
      process.env.STRIPE_MODE === "production";

    const secret = isProd
      ? process.env.STRIPE_SECRET_KEY_PROD ?? null
      : process.env.STRIPE_SECRET_KEY_TEST ?? null;
    
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET; 

    // Capture raw payload (required by Stripe when validating signatures)
    const resolveRawPayload = (): Buffer | string | null => {
      if ((req as any).rawBody) return (req as any).rawBody;
      if ((req as any).bodyRaw) return (req as any).bodyRaw;
      const body = (req as any).body;
      if (Buffer.isBuffer(body) || typeof body === "string") return body;
      if (!body) return null;
      try {
        return JSON.stringify(body);
      } catch {
        return null;
      }
    };
    const rawPayload = resolveRawPayload();

    const parseJsonBody = (): any => {
      const body = (req as any).body;
      if (body && !Buffer.isBuffer(body) && typeof body !== "string") return body;
      const source =
        typeof body === "string"
          ? body
          : Buffer.isBuffer(body)
          ? body.toString("utf8")
          : rawPayload
          ? Buffer.isBuffer(rawPayload)
            ? rawPayload.toString("utf8")
            : String(rawPayload)
          : "";
      if (!source) return null;
      try {
        return JSON.parse(source);
      } catch {
        return null;
      }
    };

    let event: any = null;
    const sig = req.headers["stripe-signature"] as string | undefined;
    if (whSecret && sig && secret) {
      // @ts-ignore
      const StripeMod = await import("stripe");
      const Stripe = (StripeMod as any).default || StripeMod;
      const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
      const payloadBuffer = Buffer.isBuffer(rawPayload)
        ? rawPayload
        : rawPayload
        ? Buffer.from(String(rawPayload), "utf8")
        : null;
      if (!payloadBuffer || !payloadBuffer.length) {
        console.log("[stripeWebhook] Missing raw payload, rejecting request");
        return res.status(400).send("No webhook payload was provided");
      }
      event = stripe.webhooks.constructEvent(payloadBuffer, sig, whSecret);
    } else {
      event = parseJsonBody();
      if (!event) {
        console.log("[stripeWebhook] Unable to parse payload without signature, rejecting request");
        return res.status(400).send("No webhook payload was provided");
      }
    }

    const type = event?.type;
    const obj = event?.data?.object || {};

    // Small helpers
    const unixToDate = (v: any): Date | null => (typeof v === "number" ? new Date(v * 1000) : v ? new Date(v) : null);

    if (type === "checkout.session.completed") {
      console.log("check session.completed est lancé");
      currentCheckoutSessionId = typeof obj?.id === "string" ? obj.id : null;
      // On successful checkout, create user if pending and activate subscription
      const email: string | undefined = obj.customer_details?.email || obj.customer_email || obj.customer?.email || obj.metadata?.email;
      const planCode: string | undefined = obj.metadata?.plan_code;
      const normalizedPlanCode = planCode ? String(planCode).toLowerCase() : undefined;
      const stripeSubscriptionId: string | undefined = obj.subscription as string | undefined;
      const stripeCustomerId: string | undefined = obj.customer as string | undefined;
      const customerDetails: any = obj.customer_details || {};

      if (!email || !normalizedPlanCode) {
        console.log("[stripeWebhook] checkout.session.completed ignored: missing email or plan code");
        return res.status(200).send("ok"); // ignore if insufficient
      }

      // Try to load plan by code
      let plan = await getPlanByCode(normalizedPlanCode);
      if (!plan) {
        const planConfig = planOption.find(
          (config) => config.name === normalizedPlanCode
        );
        if (!planConfig) {
          console.log(
            "[stripeWebhook] checkout.session.completed ignored: unknown plan code",
            normalizedPlanCode
          );
          return res.status(200).send("ok");
        }
        const basePrice =
          planConfig.prices?.CHF ??
          planConfig.price ??
          planConfig.prices?.EUR ??
          0;
        const storedPrice = Number.isFinite(basePrice)
          ? Math.round(Number(basePrice) * 100)
          : 0;
        try {
          await upsertPlanByCode({
            code: normalizedPlanCode,
            name: planConfig.name,
            price: storedPrice,
            currency_code: "CHF",
            billing_interval: "month",
            daily_credit_quota: planConfig.credit ?? 0,
            stripe_price_id: null,
          });
          plan = await getPlanByCode(normalizedPlanCode);
        } catch (seedErr) {
          console.error(
            "[stripeWebhook] Failed to seed missing plan",
            normalizedPlanCode,
            seedErr
          );
        }
        if (!plan) {
          console.log(
            "[stripeWebhook] checkout.session.completed ignored: unable to provision plan",
            normalizedPlanCode
          );
          return res.status(200).send("ok");
        }
      }

      // Find or create user using stored password_hash in EmailVerification (pending account)
      const pool = await connectDb();
      let user = await getUserByEmail(email.toLowerCase());
      if (!user) {
        const [rows] = await pool.execute<RowDataPacket[]>(
          `SELECT password_hash FROM EmailVerification WHERE email = ? AND account = 0 AND consumed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
          [email.toLowerCase()]
        );
        const rec = rows[0] as any;
        const hash = rec?.password_hash as string | undefined;
        if (!hash) {
          console.log("[stripeWebhook] checkout.session.completed: no password hash stored, leaving pending for", email);
          return res.status(200).send("ok"); // cannot finalize without password; leave pending
        }
        const newId = await createUser(email.toLowerCase(), hash);
        if (!newId) {
          console.log("[stripeWebhook] checkout.session.completed: failed to create user", email);
          return res.status(200).send("ok");
        }
        user = await getUserByEmail(email.toLowerCase());
        // mark account created
        await pool.execute<ResultSetHeader>(
          `UPDATE EmailVerification SET account = 1 WHERE email = ? AND account = 0 AND consumed_at IS NOT NULL`,
          [email.toLowerCase()]
        );
      }

      // Upsert Customer profile with details
      try {
        const fullName: string = customerDetails.name || "";
        const [firstName, ...rest] = fullName.split(" ");
        const lastName = rest.join(" ") || null;
        const addr = customerDetails.address || {};
        const phone: string | null = customerDetails.phone || null;
        const id = crypto.randomUUID();
        await pool.execute<ResultSetHeader>(
          `INSERT INTO Customer (id, user_id, email, first_name, last_name, address_line1, address_line2, postal_code, city, country, phone, stripe_customer_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             user_id=VALUES(user_id), email=VALUES(email), first_name=VALUES(first_name), last_name=VALUES(last_name),
             address_line1=VALUES(address_line1), address_line2=VALUES(address_line2), postal_code=VALUES(postal_code),
             city=VALUES(city), country=VALUES(country), phone=VALUES(phone), stripe_customer_id=VALUES(stripe_customer_id)`,
          [
            id,
            user!.id,
            email.toLowerCase(),
            firstName || null,
            lastName || null,
            addr.line1 || null,
            addr.line2 || null,
            addr.postal_code || null,
            addr.city || null,
            addr.country || null,
            phone,
            stripeCustomerId || null,
          ]
        );
      } catch {}

      // Create an active subscription if none active; attach Stripe ids
      const subId = await createSubscription({ userId: user!.id, planId: plan.id, isActive: true });
      if (subId && (stripeSubscriptionId || stripeCustomerId)) {
        await updateSubscription(subId, {
          stripe_subscription_id: stripeSubscriptionId ?? undefined,
          stripe_customer_id: stripeCustomerId ?? undefined,
        } as any);
      }

      if (currentCheckoutSessionId) {
        await markStripeCheckoutSessionCompleted(currentCheckoutSessionId, {
          userId: user!.id,
          subscriptionId: subId,
          planId: plan.id,
        });
      }

      console.log("[stripeWebhook] checkout.session.completed processed for", email.toLowerCase());
      return res.status(200).send("ok");
    }

    // invoice.paid — record invoice, increment customer's total_spent, ensure sub stays active
    if (type === "invoice.paid") {
      console.log("check invoice paid est lancé");
      const inv = obj;
      const stripeCustomerId: string | undefined = inv.customer as string | undefined;
      const stripeSubscriptionId: string | undefined = inv.subscription as string | undefined;
      const amountPaid: number = inv.amount_paid ?? 0;
      const amountDue: number = inv.amount_due ?? amountPaid;
      const currencyCode: string = String(inv.currency || "CHF").toUpperCase();
      const hostedUrl: string | null = inv.hosted_invoice_url || null;
      const invoicePdf: string | null = inv.invoice_pdf || null;
      const periodStart = unixToDate(inv.period_start);
      const periodEnd = unixToDate(inv.period_end);
      const issuedAt = unixToDate(inv.status_transitions?.paid_at || inv.created);
      const stripeInvoiceId: string = inv.id;
      const stripePaymentIntentId: string | null = inv.payment_intent || null;

      const pool = await connectDb();
      // Resolve user and subscription/plan
      let userId: string | null = null;
      let subId: string | null = null;
      let planId: string | null = null;
      // via Customer
      if (stripeCustomerId) {
        const [cu] = await pool.execute<RowDataPacket[]>(
          `SELECT user_id FROM Customer WHERE stripe_customer_id = ? LIMIT 1`,
          [stripeCustomerId]
        );
        userId = (cu[0] as any)?.user_id || null;
      }
      // via Subscription
      if (!userId && stripeCustomerId) {
        const [su] = await pool.execute<RowDataPacket[]>(
          `SELECT user_id FROM Subscription WHERE stripe_customer_id = ? LIMIT 1`,
          [stripeCustomerId]
        );
        userId = (su[0] as any)?.user_id || null;
      }
      if (stripeSubscriptionId) {
        const [su2] = await pool.execute<RowDataPacket[]>(
          `SELECT id, plan_id, user_id FROM Subscription WHERE stripe_subscription_id = ? LIMIT 1`,
          [stripeSubscriptionId]
        );
        const r = su2[0] as any;
        subId = r?.id || null;
        planId = r?.plan_id || null;
        userId = userId || r?.user_id || null;
      }
      if (!userId) {
        console.log("[stripeWebhook] invoice.paid ignored: unable to resolve user");
        return res.status(200).send("ok");
      }

      // Insert invoice (idempotent by uniq_stripe_invoice)
      try {
        const id = crypto.randomUUID();
        await pool.execute<ResultSetHeader>(
          `INSERT INTO Invoice (id, user_id, subscription_id, plan_id, stripe_invoice_id, stripe_payment_intent_id,
                                amount_due_cents, amount_paid_cents, currency_code, status, hosted_invoice_url, invoice_pdf,
                                period_start, period_end, issued_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE amount_paid_cents=VALUES(amount_paid_cents), status='paid', hosted_invoice_url=VALUES(hosted_invoice_url), invoice_pdf=VALUES(invoice_pdf)`,
          [id, userId, subId, planId, stripeInvoiceId, stripePaymentIntentId, amountDue, amountPaid, currencyCode, hostedUrl, invoicePdf, periodStart, periodEnd, issuedAt]
        );
      } catch {}

      // Increment customer total_spent
      try {
        await pool.execute<ResultSetHeader>(
          `UPDATE Customer SET total_spent_cents = total_spent_cents + ? WHERE user_id = ?`,
          [amountPaid, userId]
        );
      } catch {}

      console.log("[stripeWebhook] invoice.paid stored for user", userId);
      return res.status(200).send("ok");
    }

    // invoice.payment_failed — record or update invoice status, mark sub past_due
    if (type === "invoice.payment_failed") {
      console.log("check invoice payement failed est lancé");
      const inv = obj;
      const stripeCustomerId: string | undefined = inv.customer as string | undefined;
      const stripeSubscriptionId: string | undefined = inv.subscription as string | undefined;
      const amountDue: number = inv.amount_due ?? 0;
      const currencyCode: string = String(inv.currency || "CHF").toUpperCase();
      const stripeInvoiceId: string = inv.id;
      const pool = await connectDb();

      // find user and sub
      let userId: string | null = null;
      let subId: string | null = null;
      if (stripeCustomerId) {
        const [cu] = await pool.execute<RowDataPacket[]>(
          `SELECT user_id FROM Customer WHERE stripe_customer_id = ? LIMIT 1`,
          [stripeCustomerId]
        );
        userId = (cu[0] as any)?.user_id || null;
      }
      if (stripeSubscriptionId) {
        const [su] = await pool.execute<RowDataPacket[]>(
          `SELECT id, user_id FROM Subscription WHERE stripe_subscription_id = ? LIMIT 1`,
          [stripeSubscriptionId]
        );
        const r = su[0] as any;
        subId = r?.id || null;
        userId = userId || r?.user_id || null;
      }

      // upsert invoice as unpaid/open
      try {
        const id = crypto.randomUUID();
        await pool.execute<ResultSetHeader>(
          `INSERT INTO Invoice (id, user_id, subscription_id, plan_id, stripe_invoice_id, amount_due_cents, amount_paid_cents, currency_code, status)
           VALUES (?, ?, ?, NULL, ?, ?, 0, ?, 'unpaid')
           ON DUPLICATE KEY UPDATE status='unpaid'`,
          [id, userId, subId, stripeInvoiceId, amountDue, currencyCode]
        );
      } catch {}

      // mark subscription past_due
      if (stripeSubscriptionId) {
        await pool.execute<ResultSetHeader>(
          `UPDATE Subscription SET status = 'past_due' WHERE stripe_subscription_id = ?`,
          [stripeSubscriptionId]
        );
      }
      console.log("[stripeWebhook] invoice.payment_failed recorded for user", userId ?? "unknown");
      return res.status(200).send("ok");
    }

    // customer.subscription.deleted — cancel local subscription
    if (type === "customer.subscription.deleted") {
      console.log("check customer subscribtion deleted est lancé");
      const sub = obj;
      const stripeSubscriptionId: string | undefined = sub.id as string | undefined;
      const canceledAt = unixToDate(sub.canceled_at);
      const periodEnd = unixToDate(sub.current_period_end);

      if (stripeSubscriptionId) {
        const pool = await connectDb();
        await pool.execute<ResultSetHeader>(
          `UPDATE Subscription SET status = 'canceled', is_active = NULL, canceled_at = ?, period_end = ? WHERE stripe_subscription_id = ?`,
          [canceledAt, periodEnd, stripeSubscriptionId]
        );
      }
      console.log("[stripeWebhook] customer.subscription.deleted processed for Stripe subscription", stripeSubscriptionId);
      return res.status(200).send("ok");
    }

    console.log("[stripeWebhook] Unhandled event type received:", type);
    return res.status(200).send("ok");
  } catch (err: any) {
    console.error("stripeWebhook error:", err?.message || err);
    if (currentCheckoutSessionId) {
      try {
        await markStripeCheckoutSessionFailed(
          currentCheckoutSessionId,
          err?.message || String(err)
        );
      } catch (hookErr) {
        console.error(
          "stripeWebhook state update error:",
          (hookErr as any)?.message || hookErr
        );
      }
    }
    // Always 200 to avoid retries explosion unless you want retries
    console.log("[stripeWebhook] Error handled, responding with 200 to avoid retries");
    return res.status(200).send("ok");
  }
};

export { stripeWebhook };
