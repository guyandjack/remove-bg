import type { RequestHandler } from "express";
import { logger } from "../../logger";
import {
  getUserByEmail,
  getActiveUsage24h,
  recordCreditUsage,
} from "../../DB/queriesSQL/queriesSQL.ts";

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
      return res.status(401).json({
        status: "error",
        message: "Unauthorized: missing user payload",
        codeErr: "usage:unauth",
      });
    }

    // Récupère l'utilisateur et son usage 24h courant
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
        codeErr: "usage:user_not_found",
      });
    }

    const usage = await getActiveUsage24h(user.id);
    if (!usage) {
      return res.status(403).json({
        status: "error",
        message: "No active subscription or plan",
        codeErr: "usage:no_active_subscription",
      });
    }

    if (usage.remaining_last_24h <= 0) {
      return res.status(429).json({
        status: "error",
        message: "No more credits available for today",
        codeErr: "usage:no_credit_left",
        credits: {
          used_last_24h: usage.used_last_24h,
          remaining_last_24h: usage.remaining_last_24h,
        },
      });
    }

    // Enregistre 1 crédit utilisé dans le ledger
    try {
      await recordCreditUsage(usage.subscription_id, 1, reason);
    } catch (err: any) {
      logger.error("Failed to record credit usage", {
        err: err?.message || String(err),
        email,
        subscriptionId: usage.subscription_id,
      });
      return res.status(500).json({
        status: "error",
        message: "Failed to record credit usage",
        codeErr: "usage:record_failed",
      });
    }

    // Récupère l'état des crédits mis à jour
    const updated = await getActiveUsage24h(user.id);
    if (!updated) {
      return res.status(200).json({
        status: "success",
        message: "Usage recorded, but no usage view available",
        credits: { used_last_24h: usage.used_last_24h + 1, remaining_last_24h: Math.max(usage.remaining_last_24h - 1, 0) },
      });
    }

    return res.status(200).json({
      status: "success",
      credits: {
        used_last_24h: updated.used_last_24h,
        remaining_last_24h: updated.remaining_last_24h,
      },
    });
  } catch (error: any) {
    logger.error("updateUserDownload controller crashed", { error: error?.message || String(error) });
    return res.status(500).json({
      status: "error",
      message: error?.message || String(error),
      codeErr: "usage:unexpected",
    });
  }
};

export { updateUserDownload };
