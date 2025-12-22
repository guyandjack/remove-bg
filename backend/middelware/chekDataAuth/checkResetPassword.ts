import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const resetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: "token requis" })
      .min(10, "token invalide")
      .trim(),
    password: z
      .string({ required_error: "Mot de passe requis" })
      .max(72, "Max 72 caracteres")
      .min(8, "Min. 8 caracteres")
      .regex(/[a-z]/, "1 minuscule requise")
      .regex(/[A-Z]/, "1 majuscule requise")
      .regex(/\d/, "1 chiffre requis")
      .regex(/[^\w\s]/, "1 caractere special requis"),
    confirm: z.string({ required_error: "confirmation requise" }),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Les mots de passe ne correspondent pas",
  });

export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;

const checkResetPassword = (req: Request, res: Response, next: NextFunction) => {
  const result = resetPasswordSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: true,
      message: "Donnees invalides.",
      issues: result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      requestId: (req as any).requestId,
    });
  }

  const data: ResetPasswordDTO = result.data;
  (req as any).userValidated = {
    token: data.token,
    password: data.password,
  };

  next();
};

export { checkResetPassword };
