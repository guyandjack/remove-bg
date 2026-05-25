import type { RequestHandler } from "express";
import { logger } from "../../logger.js";
import {
  getUserByEmail,
  getActiveUsageBillingPeriod,
  recordCreditUsage,
} from "../../DB/queriesSQL/queriesSQL.js";

/**
 * Contrôleur: décrémente 1 crédit lors d'un téléchargement
 * - Récupère l'utilisateur via le token (email dans req.payload)
 * - Vérifie l'abonnement actif et les crédits restants sur 24h
 * - Si crédit dispo: enregistre l'usage (ledger) et renvoie les crédits restants
 */
const updateUserDownload: RequestHandler = async (req, res) => {
  try {
    const { email, reason } = (req as any).payload as { email: string; reason: string};
    

    if (!email || !reason) {
      logger.warn("updateUserDownload::unauthorized_missing_payload", {
        code: "ctrl_updateUserDowmload_err1",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: missing user payload",
        code: "ctrl_updateUserDowmload_err1",
        requestId: (req as any).requestId,
      });
    }

    // Récupère l'utilisateur et son usage 24h courant
    const user = await getUserByEmail(email);
    if (!user) {
      logger.warn("updateUserDownload::user_not_found", {
        code: "ctrl_updateUserDowmload_err2",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        email,
      });
      return res.status(404).json({
        status: "error",
        message: "User not found",
        code: "ctrl_updateUserDowmload_err2",
        requestId: (req as any).requestId,
      });
    }

    const usage = await getActiveUsageBillingPeriod(user.id);
    if (!usage) {
      logger.warn("updateUserDownload::no_active_subscription", {
        code: "ctrl_updateUserDowmload_err3",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
      });
      return res.status(403).json({
        status: "error",
        message: "No active subscription or plan",
        code: "ctrl_updateUserDowmload_err3",
        requestId: (req as any).requestId,
      });
    }

    if (usage.remaining_in_period <= 0) {
      logger.warn("updateUserDownload::no_credit_left", {
        code: "ctrl_updateUserDowmload_err4",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
        subscriptionId: usage.subscription_id,
      });
      return res.status(429).json({
        status: "error",
        message: "No more credits available for this billing period",
        code: "ctrl_updateUserDowmload_err4",
        requestId: (req as any).requestId,
        credits: {
          used_last_24h: usage.used_in_period,
          remaining_last_24h: usage.remaining_in_period,
        },
      });
    }

    // Enregistre 1 crédit utilisé dans le ledger
    try {
      await recordCreditUsage(usage.subscription_id, 1, reason);
    } catch (err: any) {
      logger.error("Failed to record credit usage", {
        code: "ctrl_updateUserDowmload_err5",
        requestId: (req as any).requestId,
        err: err?.message || String(err),
        email,
        subscriptionId: usage.subscription_id,
      });
      return res.status(500).json({
        status: "error",
        message: "Failed to record credit usage",
        code: "ctrl_updateUserDowmload_err5",
        requestId: (req as any).requestId,
      });
    }

    // Récupère l'état des crédits mis à jour
    const updated = await getActiveUsageBillingPeriod(user.id);
    if (!updated) {
      return res.status(200).json({
        status: "success",
        message: "Usage recorded, but no usage view available",
        credits: {
          used_last_24h: usage.used_in_period + 1,
          remaining_last_24h: Math.max(usage.remaining_in_period - 1, 0),
        },
      });
    }

    return res.status(200).json({
      status: "success",
      credits: {
        used_last_24h: updated.used_in_period,
        remaining_last_24h: updated.remaining_in_period,
      },
    });
  } catch (error: any) {
    logger.error("updateUserDownload::unhandled_error", {
      code: "ctrl_updateUserDowmload_err6",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      error: error?.message || String(error),
    });
    return res.status(500).json({
      status: "error",
      message: "internal_error",
      code: "ctrl_updateUserDowmload_err6",
      requestId: (req as any).requestId,
    });
  }
};

export { updateUserDownload };
