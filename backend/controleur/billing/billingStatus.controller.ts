import type { RequestHandler } from "express";
import { getStripeClient } from "../../function/stripe/stripeClient.js";
import { getStripeCheckoutSessionState } from "../../DB/queriesSQL/queriesSQL.js";
import { logger } from "../../logger.js";
import {
  CheckoutSessionPendingError,
  finalizeCheckoutSessionFromStripeSession,
} from "../../services/stripe/finalizeCheckoutSession.js";

function jsonError(res: any, status: number, message: string) {
  return res.status(status).json({ success: false, message });
}

type BillingStatus =
  | "paid_active"
  | "processing"
  | "failed";

export const billingStatusController: RequestHandler = async (req, res) => {
  const sessionId = String((req.query as any)?.session_id || "").trim();
  if (!sessionId) return jsonError(res, 400, "Missing session_id.");

  const stripe = getStripeClient();
  if (!stripe) return jsonError(res, 500, "Stripe is not configured on this server.");

  // DB state (source of truth for local activation)
  let dbState = await getStripeCheckoutSessionState(sessionId);

  let stripeSession: any = null;
  try {
    stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "invoice", "invoice.payment_intent"],
    } as any);
  } catch (err: any) {
    logger.warn("billing.status::stripe_session_retrieve_failed", {
      sessionId,
      message: err?.message || String(err),
    });
    // If DB knows it's completed, treat as paid_active; otherwise processing.
    const fallbackStatus: BillingStatus = dbState?.status === "completed" ? "paid_active" : "processing";
    return res.status(200).json({
      success: true,
      status: fallbackStatus,
      stripe: { session: null },
      db: dbState
        ? {
            status: dbState.status,
            plan_code: dbState.plan_code,
            consumed_at: dbState.consumed_at ? new Date(dbState.consumed_at).toISOString() : null,
          }
        : null,
      message:
        fallbackStatus === "paid_active"
          ? "Payment confirmed."
          : "Payment confirmation in progress.",
    });
  }

  const paymentStatus = String(stripeSession?.payment_status || "");
  const sessionStatus = String(stripeSession?.status || "");
  const subscriptionStatus =
    typeof stripeSession?.subscription === "object" && stripeSession.subscription
      ? String(stripeSession.subscription.status || "")
      : null;

  const isStripePaid =
    paymentStatus === "paid" || (sessionStatus === "complete" && paymentStatus !== "unpaid");
  const isStripeFailed =
    paymentStatus === "unpaid" ||
    sessionStatus === "expired";

  // If Stripe confirms payment but DB is still pending, attempt to finalize directly.
  // Webhooks remain the source of truth, but this avoids UX getting stuck when webhooks are delayed.
  if (isStripePaid && dbState?.status !== "completed") {
    try {
      await finalizeCheckoutSessionFromStripeSession({
        session: stripeSession as any,
        referer: null,
      });
      dbState = await getStripeCheckoutSessionState(sessionId);
    } catch (err: any) {
      // Pending means Stripe session metadata/subscription isn't fully ready yet; keep polling.
      if (!(err instanceof CheckoutSessionPendingError)) {
        logger.warn("billing.status::finalize_direct_failed", {
          sessionId,
          message: err?.message || String(err),
        });
      }
    }
  }

  // Webhooks remain the source of truth for DB updates.
  // UX: only show failed if Stripe explicitly confirms failure.
  let status: BillingStatus = "processing";
  if (isStripeFailed) status = "failed";
  else if (isStripePaid && dbState?.status === "completed") status = "paid_active";
  else status = "processing";

  const message =
    status === "paid_active"
      ? "Payment confirmed."
      : status === "failed"
      ? "Payment failed."
      : "Payment confirmation in progress. Please wait and do not retry payment.";

  return res.status(200).json({
    success: true,
    status,
    message,
    stripe: {
      payment_status: paymentStatus || null,
      session_status: sessionStatus || null,
      subscription_status: subscriptionStatus,
      invoice_status:
        typeof stripeSession?.invoice === "object" && stripeSession.invoice
          ? String(stripeSession.invoice.status || "")
          : null,
    },
    db: dbState
      ? {
          status: dbState.status,
          plan_code: dbState.plan_code,
          user_id: dbState.user_id,
          subscription_id: dbState.subscription_id,
          consumed_at: dbState.consumed_at ? new Date(dbState.consumed_at).toISOString() : null,
          updated_at: dbState.updated_at ? new Date(dbState.updated_at).toISOString() : null,
        }
      : null,
  });
};
