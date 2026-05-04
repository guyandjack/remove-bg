import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const changePasswordSchema = z
  .object({
    current_password: z
      .string({ message: "Mot de passe actuel requis" })
      .min(1, "Mot de passe actuel requis")
      .max(72, "Max 72 caracteres")
      .trim(),
    password: z
      .string({ message: "Mot de passe requis" })
      .max(72, "Max 72 caracteres")
      .min(8, "Min. 8 caracteres")
      .regex(/[a-z]/, "1 minuscule requise")
      .regex(/[A-Z]/, "1 majuscule requise")
      .regex(/\d/, "1 chiffre requis")
      .regex(/[^\w\s]/, "1 caractere special requis"),
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

  const data: ChangePasswordDTO = result.data;
  (req as any).userValidated = {
    current_password: data.current_password,
    password: data.password,
  };

  next();
};

export { checkChangePassword };

