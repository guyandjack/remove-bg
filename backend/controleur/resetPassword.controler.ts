import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserById, updateUser, revokeAllRefreshTokensForUser } from "../DB/queriesSQL/queriesSQL.js";
import { verifyPasswordResetToken } from "../function/createToken.js";
import { logger } from "../logger.js";

type ResetValidatedPayload = {
  token: string;
  password: string;
};

type PasswordResetPayload = {
  sub?: string;
  email?: string;
  typ?: string;
};

const resetPassword: RequestHandler = async (req, res) => {
  try {
    const { token, password } = (req as any).userValidated as ResetValidatedPayload;

    if (!token || !password) {
      logger.warn("resetPassword::missing_payload", {
        code: "ctrl_resetPassword_err1",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(400).json({
        status: "error",
        message: "Missing required payload.",
        code: "ctrl_resetPassword_err1",
        requestId: (req as any).requestId,
      });
    }

    let decoded: PasswordResetPayload;
    try {
      const verified = verifyPasswordResetToken(token);
      if (!verified || typeof verified === "string") throw new Error("Token payload invalid");
      if ((verified as any).typ !== "password_reset") throw new Error("Token type invalid");
      decoded = verified as any;
    } catch (error) {
      logger.warn("resetPassword::token_invalid", {
        code: "ctrl_resetPassword_err2",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        msg: (error as Error)?.message ?? String(error),
      });
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired token.",
        code: "ctrl_resetPassword_err2",
        requestId: (req as any).requestId,
      });
    }

    const user =
      (decoded.sub && (await getUserById(String(decoded.sub)))) ||
      (decoded.email && (await getUserByEmail(String(decoded.email))));

    if (!user) {
      logger.warn("resetPassword::user_not_found", {
        code: "ctrl_resetPassword_err3",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        sub: decoded.sub,
      });
      return res.status(400).json({
        status: "error",
        message: "Invalid token.",
        code: "ctrl_resetPassword_err3",
        requestId: (req as any).requestId,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const updated = await updateUser(user.id, { password_hash: hashedPassword });
    if (!updated) throw new Error("update failed");

    try {
      await revokeAllRefreshTokensForUser(user.id);
    } catch (error) {
      logger.warn("Unable to revoke refresh tokens after password reset", {
        code: "ctrl_resetPassword_err4",
        requestId: (req as any).requestId,
        userId: user.id,
        msg: (error as Error)?.message ?? String(error),
      });
    }

    // UX: no redirect instruction. Front decides what to do.
    return res.status(200).json({ status: "success" });
  } catch (error) {
    logger.error("resetPassword::unhandled_error", {
      code: "ctrl_resetPassword_err5",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      msg: (error as Error)?.message ?? String(error),
    });
    return res.status(500).json({
      status: "error",
      message: "internal_error",
      code: "ctrl_resetPassword_err5",
      requestId: (req as any).requestId,
    });
  }
};

export { resetPassword };

