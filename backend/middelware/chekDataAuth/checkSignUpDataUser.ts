import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { validationLimits, validationRegex, toRegExp } from "../../shared/validationRegex.js";
import { computeEmailHmacSha256Hex } from "../../utils/emailGuard.js";
import { hasActiveFreePlanEmailGuard } from "../../DB/queriesSQL/freePlanEmailGuard.queries.js";
import { logger } from "../../logger.js";

export const authSchema = z.object({
  email: z.email("Email invalide").trim().toLowerCase(),
  password: z
    .string()
    .max(validationLimits.password.max, "Max 72 caractères")
    .min(validationLimits.password.min, "Min. 8 caractères")
    .regex(toRegExp(validationRegex.passwordLower), "1 minuscule requise")
    .regex(toRegExp(validationRegex.passwordUpper), "1 majuscule requise")
    .regex(toRegExp(validationRegex.passwordDigit), "1 chiffre requis")
    .regex(toRegExp(validationRegex.passwordSpecial), "1 caractère spécial requis"),
  confirm: z
    .string()
    .max(validationLimits.password.max, "Max 72 caractères")
    .min(validationLimits.password.min, "Min. 8 caractères")
    .regex(toRegExp(validationRegex.passwordLower), "1 minuscule requise")
    .regex(toRegExp(validationRegex.passwordUpper), "1 majuscule requise")
    .regex(toRegExp(validationRegex.passwordDigit), "1 chiffre requis")
    .regex(toRegExp(validationRegex.passwordSpecial), "1 caractère spécial requis"),
  lang: z.enum(["fr", "de", "en", "it"]),
  plan: z.enum(["free", "hobby", "pro"], "Plan non reconnu"),
  currency: z.enum(["CHF", "EUR", "USD"]).default("CHF"),
  id: z.literal("resend").optional(),
});

export type AuthDTO = z.infer<typeof authSchema>;

const checkSignUpDataUser = async (req: Request, res: Response, next: NextFunction) => {
  const result = authSchema.safeParse(req.body);
  if (!result.success) {
    logger.warn("checkSignUpDataUser::invalid_body", {
      code: "mw_checkSignUpDataUser_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      issues: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return res.status(400).json({
      error: true,
      message: "Données invalides.",
      issues: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      code: "mw_checkSignUpDataUser_err1",
      requestId: (req as any).requestId,
    });
  }

  const { password, confirm } = result.data;
  if (password !== confirm) {
    logger.warn("checkSignUpDataUser::password_mismatch", {
      code: "mw_checkSignUpDataUser_err2",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
    });
    return res.status(400).json({
      error: true,
      message: "Password error.",
      code: "mw_checkSignUpDataUser_err2",
      requestId: (req as any).requestId,
    });
  }

  const data: AuthDTO = result.data;
  // Free plan anti-abuse: prevent reusing "free credits" by deleting and recreating an account.
  // - Never store the clear email in this guard table.
  // - Never log email nor HMAC.
  if (String(data.plan || "").toLowerCase() === "free") {
    try {
      const emailHmac = computeEmailHmacSha256Hex(data.email);
      const blocked = await hasActiveFreePlanEmailGuard(emailHmac);
      if (blocked) {
        logger.warn("checkSignUpDataUser::free_plan_already_used", {
          code: "mw_checkSignUpDataUser_err3",
          requestId: (req as any).requestId,
          method: req.method,
          path: req.originalUrl || req.url,
        });
        return res.status(409).json({
          error: true,
          message: "Free plan already used recently.",
          code: "mw_checkSignUpDataUser_err3",
          requestId: (req as any).requestId,
        });
      }
    } catch (error: any) {
      logger.error("checkSignUpDataUser::email_guard_failed", {
        code: "mw_checkSignUpDataUser_err4",
        requestId: (req as any).requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        message: error?.message ?? String(error),
      });
      return res.status(500).json({
        error: true,
        message: "Server error.",
        code: "mw_checkSignUpDataUser_err4",
        requestId: (req as any).requestId,
      });
    }
  }

  (req as any).userValidated = {
    email: data.email,
    password: data.password,
    confirm: data.confirm,
    lang: data.lang,
    plan: data.plan || "",
    currency: data.currency || "CHF",
    id: data.id || "",
  };
  next();
};

export { checkSignUpDataUser };
