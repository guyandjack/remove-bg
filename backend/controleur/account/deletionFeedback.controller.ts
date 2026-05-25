import type { RequestHandler } from "express";
import crypto from "node:crypto";
import { logger } from "../../logger.js";
import { submitAccountDeletionFeedbackByTokenHash } from "../../DB/queriesSQL/queriesSQL.js";
import { getHashedVisitorIp } from "../../utils/visitorIpHash.js";

export const accountDeletionFeedbackController: RequestHandler = async (req, res) => {
  const validated = (req as any).deletionFeedbackValidated as
    | {
        token: string;
        reasons: Record<string, boolean | undefined>;
        other_text?: string | null;
      }
    | undefined;

  if (!validated) {
    logger.warn("account.deletion_feedback::missing_payload", {
      code: "ctrl_deletionFeedback_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(400).json({
      success: false,
      message: "Missing payload.",
      code: "ctrl_deletionFeedback_err1",
    });
  }

  const tokenHash = crypto.createHash("sha256").update(validated.token).digest("hex");

  let submittedIpHash: string | null = null;
  try {
    submittedIpHash = getHashedVisitorIp(req).hashedIp;
  } catch {
    submittedIpHash = null;
  }

  const userAgentRaw = req.headers["user-agent"];
  const userAgent = typeof userAgentRaw === "string" ? userAgentRaw.slice(0, 255) : null;

  const otherText =
    typeof validated.other_text === "string" && validated.other_text.trim()
      ? validated.other_text.trim()
      : null;

  const reasonsJson = (() => {
    try {
      return JSON.stringify(validated.reasons ?? {});
    } catch {
      return null;
    }
  })();

  try {
    const ok = await submitAccountDeletionFeedbackByTokenHash({
      tokenHash,
      reasonsJson,
      otherText,
      userAgent,
      submittedIpHash,
    });
    if (!ok) {
      logger.warn("account.deletion_feedback::token_expired_or_used", {
        code: "ctrl_deletionFeedback_err2",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(404).json({
        success: false,
        message: "Lien expiré ou déjà utilisé.",
        code: "ctrl_deletionFeedback_err2",
      });
    }
    return res.status(200).json({ success: true });
  } catch (err: any) {
    logger.warn("account.deletion_feedback::db_failed", {
      code: "ctrl_deletionFeedback_err3",
      requestId: (req as any).requestId,
      message: err?.message ?? String(err),
    });
    return res.status(500).json({
      success: false,
      message: "Server error.",
      code: "ctrl_deletionFeedback_err3",
    });
  }
};
