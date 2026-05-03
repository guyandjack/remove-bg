import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { getUserByEmail, updateUser, revokeAllRefreshTokensForUser } from "../../DB/queriesSQL/queriesSQL.ts";
import { logger } from "../../logger.ts";

type ChangePasswordValidatedPayload = {
  current_password: string;
  password: string;
};

export const changePasswordController: RequestHandler = async (req, res) => {
  try {
    const email = (req as any)?.payload?.email as string | undefined;
    const { current_password, password } = (req as any).userValidated as ChangePasswordValidatedPayload;

    if (!email) {
      return res.status(401).json({ status: "error", message: "unauthorized" });
    }
    if (!current_password || !password) {
      return res.status(400).json({ status: "error", message: "missing payload change_password_1" });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ status: "error", message: "unauthorized" });
    }

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
      return res.status(400).json({ status: "error", message: "incorrect current password" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const updated = await updateUser(user.id, { password_hash: hashedPassword });
    if (!updated) {
      throw new Error("update failed");
    }

    try {
      await revokeAllRefreshTokensForUser(user.id);
    } catch (error) {
      logger.warn("Unable to revoke refresh tokens after password change", {
        userId: user.id,
        msg: (error as Error)?.message ?? String(error),
      });
    }

    return res.status(200).json({ status: "success" });
  } catch (error) {
    logger.error("Change password error", { msg: (error as Error)?.message ?? String(error) });
    return res.status(500).json({ status: "error", message: "server error change_password_2" });
  }
};

