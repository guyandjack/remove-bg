import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { validationLimits, validationRegex, toRegExp } from "../../shared/validationRegex.js";
import { logger } from "../../logger.js";

export const authSchema = z.object({
  email: z.email("email invalide").trim().toLowerCase(),
  password: z
    .string()
    // Keep legacy messages even if they contain inconsistent numbers.
    .max(validationLimits.password.max, "Max 30 caractères")
    .min(validationLimits.password.min, "Min. 8 caractères")
    .regex(toRegExp(validationRegex.passwordLower), "1 minuscule requise")
    .regex(toRegExp(validationRegex.passwordUpper), "1 majuscule requise")
    // BUGFIX: require at least one digit (previous /[^0-9]/ was the opposite).
    .regex(toRegExp(validationRegex.passwordDigit), "1 chiffre requis")
    .regex(toRegExp(validationRegex.passwordSpecial), "1 caractère spécial requis"),
});

export type AuthDTO = z.infer<typeof authSchema>;

const checkLoginDataUser = (req: Request, res: Response, next: NextFunction) => {
  const result = authSchema.safeParse(req.body);
  if (!result.success) {
    logger.warn("checkLoginDataUser::invalid_body", {
      code: "mw_checkLoginDataUser_err1",
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
      code: "mw_checkLoginDataUser_err1",
      requestId: (req as any).requestId,
    });
  }

  const data: AuthDTO = result.data;
  (req as any).userValidated = {
    email: data.email,
    password: data.password,
  };
  next();
};

export { checkLoginDataUser };
