import type Stripe from "stripe";

export type BillingLockCode =
  | "subscription_not_actionable"
  | "subscription_has_pending_update"
  | "invoice_open_or_draft"
  | "payment_intent_incomplete";

export type BillingLock =
  | { locked: false }
  | {
      locked: true;
      code: BillingLockCode;
      debug?: Record<string, unknown>;
    };

const asObject = <T>(v: unknown): T | null =>
  v && typeof v === "object" ? (v as T) : null;

export function formatBillingLockMessage(params: {
  locale: "fr" | "en" | "de" | "it";
  lock: Exclude<BillingLock, { locked: false }>;
}): string {
  const { locale, lock } = params;
  const base =
    locale === "fr"
      ? "Opération impossible pour le moment : "
      : "Operation not allowed right now: ";

  switch (lock.code) {
    case "subscription_not_actionable": {
      const status = String(lock.debug?.subscriptionStatus || "");
      return locale === "fr"
        ? `${base}abonnement dans un état de facturation non modifiable (statut Stripe: ${status || "inconnu"}).`
        : `${base}subscription is not actionable (Stripe status: ${status || "unknown"}).`;
    }
    case "subscription_has_pending_update":
      return locale === "fr"
        ? `${base}une mise à jour d’abonnement est en attente chez Stripe.`
        : `${base}a subscription update is pending on Stripe.`;
    case "invoice_open_or_draft":
      return locale === "fr"
        ? `${base}une facture est en cours (open/draft). Attendez sa finalisation avant de continuer.`
        : `${base}an invoice is currently open/draft. Please wait for it to finalize.`;
    case "payment_intent_incomplete":
      return locale === "fr"
        ? `${base}un paiement est en cours de validation. Attendez la confirmation Stripe avant de continuer.`
        : `${base}a payment is being confirmed. Please wait for Stripe confirmation.`;
    default:
      return locale === "fr"
        ? `${base}facturation en cours.`
        : `${base}billing in progress.`;
  }
}

/**
 * Detects a "billing in-flight" state on Stripe that could lead to litigable edge cases:
 * - open/draft invoices
 * - payment intents not finalized
 * - subscription status not actionable (incomplete/past_due/unpaid/paused/...)
 * - pending updates waiting for payment
 *
 * We use this as a hard guard before allowing cancel/resume/change/delete operations.
 */
export async function getStripeBillingLock(params: {
  stripe: Stripe;
  stripeSubscriptionId: string;
}): Promise<BillingLock> {
  const { stripe, stripeSubscriptionId } = params;

  // 1) Inspect subscription (fast path)
  const sub: any = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["latest_invoice.payment_intent"],
  } as any);

  const subscriptionStatus = String(sub?.status || "");
  const pendingUpdate = sub?.pending_update ? true : false;

  // Anything other than active/trialing is considered risky for mutations.
  // This is intentionally strict given the "no pending payments" requirement.
  if (!["active", "trialing"].includes(subscriptionStatus)) {
    return {
      locked: true,
      code: "subscription_not_actionable",
      debug: { subscriptionStatus },
    };
  }

  if (pendingUpdate) {
    return {
      locked: true,
      code: "subscription_has_pending_update",
      debug: { subscriptionStatus },
    };
  }

  const latestInvoice = asObject<any>(sub?.latest_invoice);
  if (latestInvoice) {
    const invoiceStatus = String(latestInvoice.status || "");
    const amountDue = Number(latestInvoice.amount_due ?? 0);
    if (["open", "draft"].includes(invoiceStatus) && amountDue > 0) {
      return {
        locked: true,
        code: "invoice_open_or_draft",
        debug: { invoiceStatus, amountDue },
      };
    }

    const paymentIntent = asObject<any>(latestInvoice.payment_intent);
    if (paymentIntent) {
      const piStatus = String(paymentIntent.status || "");
      const finalized = piStatus === "succeeded" || piStatus === "canceled";
      if (!finalized) {
        return {
          locked: true,
          code: "payment_intent_incomplete",
          debug: { piStatus, invoiceStatus },
        };
      }
    }
  }

  // 2) Defensive: list a few invoices for that subscription
  // Subscription.latest_invoice can be missing depending on API/version; invoice list is more reliable.
  try {
    const invoices: any = await stripe.invoices.list({
      subscription: stripeSubscriptionId,
      limit: 5,
    } as any);
    for (const inv of invoices?.data || []) {
      const status = String(inv?.status || "");
      const amountDue = Number(inv?.amount_due ?? 0);
      if (["open", "draft"].includes(status) && amountDue > 0) {
        return {
          locked: true,
          code: "invoice_open_or_draft",
          debug: { invoiceStatus: status, amountDue },
        };
      }
    }
  } catch {
    // If invoice listing fails, do not block by default (avoid false positives),
    // but the subscription inspection above already catches most issues.
  }

  return { locked: false };
}
