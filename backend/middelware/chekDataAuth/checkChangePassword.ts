import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { validationLimits, validationRegex, toRegExp } from "../../shared/validationRegex.js";
import { logger } from "../../logger.js";

export const changePasswordSchema = z
  .object({
    current_password: z
      .string({ message: "Mot de passe actuel requis" })
      .min(1, "Mot de passe actuel requis")
      .max(validationLimits.password.max, "Max 72 caracteres")
      .trim(),
    password: z
      .string({ message: "Mot de passe requis" })
      .max(validationLimits.password.max, "Max 72 caracteres")
      .min(validationLimits.password.min, "Min. 8 caracteres")
      .regex(toRegExp(validationRegex.passwordLower), "1 minuscule requise")
      .regex(toRegExp(validationRegex.passwordUpper), "1 majuscule requise")
      .regex(toRegExp(validationRegex.passwordDigit), "1 chiffre requis")
      .regex(toRegExp(validationRegex.passwordSpecial), "1 caractere special requis"),
    confirm: z.string({ message: "confirmation requise" }),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas",
  });

export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;

const checkChangePassword = (req: Request, res: Response, next: NextFunction) => {
  const result = changePasswordSchema.safeParse(req.body);

  if (!result.success) {
    logger.warn("checkChangePassword::invalid_body", {
      code: "mw_checkChangePassword_err1",
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
      message: "Donnees invalides.",
      issues: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      code: "mw_checkChangePassword_err1",
      requestId: (req as any).requestId,
    });
  }

  const data: ChangePasswordDTO = result.data;
  (req as any).userValidated = {
    current_password: data.current_password,
    password: data.password,
  };

  next();
};

export { checkChangePassword };
