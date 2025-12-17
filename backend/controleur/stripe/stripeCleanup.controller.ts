import type { RequestHandler } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { connectDb } from "../../DB/poolConnexion/poolConnexion.ts";

const cleanupStripeCheckout: RequestHandler = async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({
        status: "error",
        message: "missing_session_id",
      });
    }

    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return res.status(400).json({
        status: "error",
        message: "invalid_session_id",
      });
    }

    const pool = await connectDb();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT email FROM StripeCheckoutSession WHERE session_id = ? LIMIT 1`,
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
      `DELETE FROM StripeCheckoutSession WHERE session_id = ?`,
      [normalizedSessionId]
    );

    if (record.email) {
      await pool.execute<ResultSetHeader>(
        `DELETE FROM EmailVerification WHERE email = ? AND account = 0`,
        [record.email]
      );
    }

    return res.status(200).json({
      status: "success",
      message: "session_cleaned",
    });
  } catch (err: any) {
    console.error("cleanupStripeCheckout error:", err?.message || err);
    return res.status(500).json({
      status: "error",
      message: err?.message || String(err),
    });
  }
};

export { cleanupStripeCheckout };
