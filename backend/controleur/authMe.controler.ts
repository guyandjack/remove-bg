import type { Request, Response } from "express";
import {
  getActiveUsageBillingPeriod,
  getPlanById,
  getUserByEmail,
} from "../DB/queriesSQL/queriesSQL.js";
import { getConversionQuotaSnapshotForUser } from "../DB/queriesSQL/conversionQuota.queries.js";
import { logger } from "../logger.js";

const authMe = async (req: Request, res: Response) => {
  const httpRequestId = (req as any).requestId;
  const email = ((req as any).payload as any)?.email ?? (req as any).payload ?? null;

  if (!email || typeof email !== "string") {
    logger.warn("authMe::missing_payload_email", {
      code: "ctrl_authMe_err1",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(500).json({
      status: "error",
      message: "User unknown",
      code: "ctrl_authMe_err1",
      requestId: httpRequestId,
    });
  }

  const userRow = await getUserByEmail(email);
  if (!userRow) {
    logger.warn("authMe::user_not_found", {
      code: "ctrl_authMe_err2",
      requestId: httpRequestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(404).json({
      status: "error",
      message: "User not found",
      code: "ctrl_authMe_err2",
      requestId: httpRequestId,
    });
  }

  const usage = await getActiveUsageBillingPeriod(userRow.id);
  const plan = usage ? await getPlanById(usage.plan_id) : null;
  const converter = await getConversionQuotaSnapshotForUser(userRow.id);

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
    creditRemainingConcerter: converter?.remaining ?? 0,
    creditUsedConverter: converter?.used ?? 0,
    subscriptionId: usage?.subscription_id ?? null,
  });
};

export { authMe };
