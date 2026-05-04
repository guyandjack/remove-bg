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
      return res.status(400).json({ status: "error", message: "missing payload reset_1" });
    }

    let decoded: PasswordResetPayload;
    try {
      const verified = verifyPasswordResetToken(token);
      if (!verified || typeof verified === "string") throw new Error("Token payload invalid");
      if ((verified as any).typ !== "password_reset") throw new Error("Token type invalid");
      decoded = verified as any;
    } catch (error) {
      logger.warn("Reset password token invalid", { msg: (error as Error)?.message ?? String(error) });
      return res.status(400).json({ status: "error", message: "invalid or expired token reset_2" });
    }

    const user =
      (decoded.sub && (await getUserById(String(decoded.sub)))) ||
      (decoded.email && (await getUserByEmail(String(decoded.email))));

    if (!user) {
      logger.warn("Reset password user not found", { sub: decoded.sub, email: decoded.email });
      return res.status(400).json({ status: "error", message: "invalid token reset_3" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const updated = await updateUser(user.id, { password_hash: hashedPassword });
    if (!updated) throw new Error("update failed");

    try {
      await revokeAllRefreshTokensForUser(user.id);
    } catch (error) {
      logger.warn("Unable to revoke refresh tokens after password reset", {
        userId: user.id,
        msg: (error as Error)?.message ?? String(error),
      });
    }

    // UX: no redirect instruction. Front decides what to do.
    return res.status(200).json({ status: "success" });
  } catch (error) {
    logger.error("Reset password error", { msg: (error as Error)?.message ?? String(error) });
    return res.status(500).json({ status: "error", message: "server error reset_4" });
  }
};

export { resetPassword };

