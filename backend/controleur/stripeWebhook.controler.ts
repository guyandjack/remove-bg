import type { RequestHandler } from "express";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { connectDb } from "../DB/poolConnexion/poolConnexion.ts";
import { getPlanByCode, getUserByEmail, createUser, createSubscription, updateSubscription } from "../DB/queriesSQL/queriesSQL.ts";

// Stripe webhook to finalize paid signups and activate subscriptions
// Handles: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted
// Note: For signature verification, ensure your server uses raw body middleware for this route

const stripeWebhook: RequestHandler = async (req, res) => {
  try {
    const secret = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_TEST;
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET; // optional but recommended

    // Fallback processing without signature if not configured
    let event: any = (req as any).body;
    if (whSecret && secret) {
      // @ts-ignore
      const StripeMod = await import("stripe");
      const Stripe = (StripeMod as any).default || StripeMod;
      const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
      const sig = req.headers["stripe-signature"] as string | undefined;
      if (!sig) return res.status(400).send("Missing signature");
      const rawBody = (req as any).rawBody || (req as any).bodyRaw || JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
    }

    const type = event?.type;
    const obj = event?.data?.object || {};

    // Small helpers
    const unixToDate = (v: any): Date | null => (typeof v === "number" ? new Date(v * 1000) : v ? new Date(v) : null);

    if (type === "checkout.session.completed") {
      // On successful checkout, create user if pending and activate subscription
      const email: string | undefined = obj.customer_details?.email || obj.customer_email || obj.customer?.email || obj.metadata?.email;
      const planCode: string | undefined = obj.metadata?.plan_code;
      const stripeSubscriptionId: string | undefined = obj.subscription as string | undefined;
      const stripeCustomerId: string | undefined = obj.customer as string | undefined;
      const customerDetails: any = obj.customer_details || {};

      if (!email || !planCode) return res.status(200).send("ok"); // ignore if insufficient

      // Try to load plan by code
      const plan = await getPlanByCode(String(planCode).toLowerCase());
      if (!plan) return res.status(200).send("ok");

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
        if (!hash) return res.status(200).send("ok"); // cannot finalize without password; leave pending
        const newId = await createUser(email.toLowerCase(), hash);
        if (!newId) return res.status(200).send("ok");
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

      return res.status(200).send("ok");
    }

    // invoice.paid — record invoice, increment customer's total_spent, ensure sub stays active
    if (type === "invoice.paid") {
      const inv = obj;
      const stripeCustomerId: string | undefined = inv.customer as string | undefined;
      const stripeSubscriptionId: string | undefined = inv.subscription as string | undefined;
      const amountPaid: number = inv.amount_paid ?? 0;
      const amountDue: number = inv.amount_due ?? amountPaid;
      const currency: string = String(inv.currency || "EUR").toUpperCase();
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
      if (!userId) return res.status(200).send("ok");

      // Insert invoice (idempotent by uniq_stripe_invoice)
      try {
        const id = crypto.randomUUID();
        await pool.execute<ResultSetHeader>(
          `INSERT INTO Invoice (id, user_id, subscription_id, plan_id, stripe_invoice_id, stripe_payment_intent_id,
                                amount_due_cents, amount_paid_cents, currency, status, hosted_invoice_url, invoice_pdf,
                                period_start, period_end, issued_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE amount_paid_cents=VALUES(amount_paid_cents), status='paid', hosted_invoice_url=VALUES(hosted_invoice_url), invoice_pdf=VALUES(invoice_pdf)`,
          [id, userId, subId, planId, stripeInvoiceId, stripePaymentIntentId, amountDue, amountPaid, currency, hostedUrl, invoicePdf, periodStart, periodEnd, issuedAt]
        );
      } catch {}

      // Increment customer total_spent
      try {
        await pool.execute<ResultSetHeader>(
          `UPDATE Customer SET total_spent_cents = total_spent_cents + ? WHERE user_id = ?`,
          [amountPaid, userId]
        );
      } catch {}

      return res.status(200).send("ok");
    }

    // invoice.payment_failed — record or update invoice status, mark sub past_due
    if (type === "invoice.payment_failed") {
      const inv = obj;
      const stripeCustomerId: string | undefined = inv.customer as string | undefined;
      const stripeSubscriptionId: string | undefined = inv.subscription as string | undefined;
      const amountDue: number = inv.amount_due ?? 0;
      const currency: string = String(inv.currency || "EUR").toUpperCase();
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
          `INSERT INTO Invoice (id, user_id, subscription_id, plan_id, stripe_invoice_id, amount_due_cents, amount_paid_cents, currency, status)
           VALUES (?, ?, ?, NULL, ?, ?, 0, ?, 'unpaid')
           ON DUPLICATE KEY UPDATE status='unpaid'`,
          [id, userId, subId, stripeInvoiceId, amountDue, currency]
        );
      } catch {}

      // mark subscription past_due
      if (stripeSubscriptionId) {
        await pool.execute<ResultSetHeader>(
          `UPDATE Subscription SET status = 'past_due' WHERE stripe_subscription_id = ?`,
          [stripeSubscriptionId]
        );
      }
      return res.status(200).send("ok");
    }

    // customer.subscription.deleted — cancel local subscription
    if (type === "customer.subscription.deleted") {
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
      return res.status(200).send("ok");
    }

    return res.status(200).send("ok");
  } catch (err: any) {
    console.error("stripeWebhook error:", err?.message || err);
    // Always 200 to avoid retries explosion unless you want retries
    return res.status(200).send("ok");
  }
};

export { stripeWebhook };
