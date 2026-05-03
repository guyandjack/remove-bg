import type { RequestHandler } from "express";
import {
  getActiveSubscription,
  getCustomerByUserId,
  getPlanById,
  getUserByEmail,
} from "../../DB/queriesSQL/queriesSQL.ts";

function formatIsoDateTime(d: Date | null): string | null {
  if (!d) return null;
  try {
    return new Date(d).toISOString();
  } catch {
    return null;
  }
}

function formatIsoDate(d: Date | null): string | null {
  const v = formatIsoDateTime(d);
  return v ? v.slice(0, 10) : null;
}

export const billingAccountStatusController: RequestHandler = async (req, res) => {
  const email =
    ((req as any).payload as any)?.email ?? (req as any).payload ?? null;
  if (!email || typeof email !== "string") {
    return res.status(401).json({ success: false, message: "Unauthenticated." });
  }

  const user = await getUserByEmail(String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const sub = await getActiveSubscription(user.id);
  const plan = sub ? await getPlanById(sub.plan_id) : null;
  const customer = await getCustomerByUserId(user.id);

  const planAccessUntil = sub
    ? sub.plan_access_until ?? sub.current_period_end ?? sub.period_end ?? null
    : null;

  const periodStart = sub?.period_start ?? null;
  const periodEnd = sub?.current_period_end ?? sub?.period_end ?? null;

  return res.status(200).json({
    success: true,
    customer: {
      first_name: customer?.first_name ?? null,
      last_name: customer?.last_name ?? null,
      email: customer?.email ?? user.email,
    },
    marketing: {
      marketing_consent: user.marketing_consent === 1,
      marketing_consent_updated_at: formatIsoDateTime(user.marketing_consent_updated_at),
    },
    subscription: sub
      ? {
          subscription_status: sub.status,
          stripe_subscription_id: sub.stripe_subscription_id ? "present" : null,
          stripe_cancel_at_period_end: sub.stripe_cancel_at_period_end === 1,
          current_period_end: formatIsoDateTime(sub.current_period_end),
          period_start: formatIsoDateTime(periodStart ? new Date(periodStart) : null),
          period_end: formatIsoDateTime(periodEnd ? new Date(periodEnd) : null),
          period_start_date: formatIsoDate(periodStart ? new Date(periodStart) : null),
          period_end_date: formatIsoDate(periodEnd ? new Date(periodEnd) : null),
          plan_access_until: formatIsoDateTime(planAccessUntil ? new Date(planAccessUntil) : null),
          plan_access_until_date: formatIsoDate(planAccessUntil ? new Date(planAccessUntil) : null),
          plan_name: plan?.name ?? (sub as any).plan_name ?? null,
          plan_code: plan?.code ?? null,
          pending_change_type: sub.pending_change_type,
          pending_change_effective_at: formatIsoDateTime(sub.pending_change_effective_at),
        }
      : null,
    account: {
      account_deletion_requested: user.account_deletion_requested === 1,
      account_deletion_requested_at: formatIsoDateTime(user.account_deletion_requested_at),
    },
  });
};
