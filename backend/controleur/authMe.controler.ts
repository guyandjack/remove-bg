import type { Request, Response } from "express";
import {
  getActiveUsageBillingPeriod,
  getPlanById,
  getUserByEmail,
} from "../DB/queriesSQL/queriesSQL.ts";

const authMe = async (req: Request, res: Response) => {
  const email = ((req as any).payload as any)?.email ?? (req as any).payload ?? null;

  if (!email || typeof email !== "string") {
    return res.status(500).json({
      status: "error",
      message: "User unknown",
      errorCode: "auth1",
    });
  }

  const userRow = await getUserByEmail(email);
  if (!userRow) {
    return res.status(404).json({
      status: "error",
      message: "User not found",
      errorCode: "auth2",
    });
  }

  const usage = await getActiveUsageBillingPeriod(userRow.id);
  const plan = usage ? await getPlanById(usage.plan_id) : null;

  return res.status(200).json({
    status: "success",
    user: {
      email,
      authentified: true,
    },
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          price_cents: plan.price,
          currency: plan.currency_code,
          daily_credit_quota: plan.daily_credit_quota,
        }
      : null,
    credits: usage
      ? {
          used_last_24h: usage.used_in_period,
          remaining_last_24h: usage.remaining_in_period,
        }
      : null,
    subscriptionId: usage?.subscription_id ?? null,
  });
};

export { authMe };
