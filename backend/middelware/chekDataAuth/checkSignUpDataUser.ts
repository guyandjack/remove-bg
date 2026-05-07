import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { validationLimits, validationRegex, toRegExp } from "../../shared/validationRegex.js";

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

const checkSignUpDataUser = (req: Request, res: Response, next: NextFunction) => {
  const result = authSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: true,
      message: "Données invalides.",
      issues: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      requestId: (req as any).requestId,
    });
  }

  const { password, confirm } = result.data;
  if (password !== confirm) {
    return res.status(400).json({
      error: true,
      message: "Password error.",
      requestId: (req as any).requestId,
    });
  }

  const data: AuthDTO = result.data;
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

