import type { RequestHandler } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectDb } from "../../DB/poolConnexion/poolConnexion.js";
import { logger } from "../../logger.js";

const cleanupStripeCheckout: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== "string") {
      logger.warn("cleanupStripeCheckout::missing_session_id", {
        code: "ctrl_stripeCleanup_err1",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(400).json({
        status: "error",
        message: "missing_session_id",
        code: "ctrl_stripeCleanup_err1",
      });
    }

    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      logger.warn("cleanupStripeCheckout::invalid_session_id", {
        code: "ctrl_stripeCleanup_err2",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(400).json({
        status: "error",
        message: "invalid_session_id",
        code: "ctrl_stripeCleanup_err2",
      });
    }

    const pool = await connectDb();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT email FROM \`StripeCheckoutSession\` WHERE session_id = ? LIMIT 1`,
      [normalizedSessionId]
    );
    const record = rows[0] as RowDataPacket | undefined;

    if (!record) {
      return res.status(200).json({
        status: "success",
        message: "session_not_found",
      });
    }

    await pool.execute<ResultSetHeader>(
      `DELETE FROM \`StripeCheckoutSession\` WHERE session_id = ?`,
      [normalizedSessionId]
    );

    if (record.email) {
      await pool.execute<ResultSetHeader>(
        // Preserve history: just invalidate any pending OTP rows linked to this email.
        `UPDATE \`EmailVerification\` SET active = NULL WHERE email = ? AND account = 0`,
        [record.email]
      );
    }

    return res.status(200).json({
      status: "success",
      message: "session_cleaned",
    });
  } catch (err: any) {
    logger.error("cleanupStripeCheckout::unhandled_error", {
      code: "ctrl_stripeCleanup_err3",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      message: err?.message ?? String(err),
    });
    return res.status(500).json({
      status: "error",
      message: err?.message || String(err),
      code: "ctrl_stripeCleanup_err3",
    });
  }
};

export { cleanupStripeCheckout };
