import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { getUserByEmail, updateUser, revokeAllRefreshTokensForUser, revokeAllRefreshTokensForUserExcept } from "../../DB/queriesSQL/queriesSQL.js";
import { logger } from "../../logger.js";
import jwt from "jsonwebtoken";

type ChangePasswordValidatedPayload = {
  current_password: string;
  password: string;
};

export const changePasswordController: RequestHandler = async (req, res) => {
  try {
    const email = (req as any)?.payload?.email as string | undefined;
    const { current_password, password } = (req as any).userValidated as ChangePasswordValidatedPayload;

    if (!email) {
      logger.warn("changePassword::unauthorized", {
        code: "ctrl_changePassword_err1",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(401).json({
        status: "error",
        message: "unauthorized",
        code: "ctrl_changePassword_err1",
      });
    }
    if (!current_password || !password) {
      logger.warn("changePassword::missing_payload", {
        code: "ctrl_changePassword_err2",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(400).json({
        status: "error",
        message: "missing payload change_password_1",
        code: "ctrl_changePassword_err2",
      });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      logger.warn("changePassword::user_not_found", {
        code: "ctrl_changePassword_err3",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
      });
      return res.status(401).json({
        status: "error",
        message: "unauthorized",
        code: "ctrl_changePassword_err3",
      });
    }

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
      logger.warn("changePassword::incorrect_current_password", {
        code: "ctrl_changePassword_err4",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        userId: user.id,
      });
      return res.status(400).json({
        status: "error",
        message: "incorrect current password",
        code: "ctrl_changePassword_err4",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const updated = await updateUser(user.id, { password_hash: hashedPassword });
    if (!updated) {
      throw new Error("update failed");
    }

    try {
      // Security: revoke refresh tokens for other sessions/devices, but keep the current session usable.
      // The current session's refresh token is stored in the HttpOnly cookie `tokenRefresh`.
      const refreshCookie = (req as any)?.cookies?.tokenRefresh as string | undefined;
      const decoded = refreshCookie ? (jwt.decode(refreshCookie) as any) : null;
      const currentJti: string | undefined = decoded?.jti || decoded?.jwtid;
      const currentUserId: string | undefined = decoded?.userId;

      if (currentJti && String(currentUserId || "") === String(user.id)) {
        await revokeAllRefreshTokensForUserExcept(user.id, currentJti);
      } else {
        // Fallback: if we can't identify the current refresh token, revoke all (safer, but may log out current session).
        await revokeAllRefreshTokensForUser(user.id);
      }
    } catch (error) {
      logger.warn("Unable to revoke refresh tokens after password change", {
        code: "ctrl_changePassword_err5",
        requestId: (req as any).requestId,
        userId: user.id,
        msg: (error as Error)?.message ?? String(error),
      });
    }

    return res.status(200).json({ status: "success" });
  } catch (error) {
    logger.error("Change password error", {
      code: "ctrl_changePassword_err6",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      msg: (error as Error)?.message ?? String(error),
    });
    return res.status(500).json({
      status: "error",
      message: "server error change_password_2",
      code: "ctrl_changePassword_err6",
    });
  }
};
