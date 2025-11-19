import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const authSchema = z.object({
  email: z.email("email invalide").trim().toLowerCase(),
  password: z
    .string()
    .max(72, "Max 30 caractères")
    .min(8, "Min. 8 caractères")
    .regex(/[a-z]/, "1 minuscule requise")
    .regex(/[A-Z]/, "1 majuscule requise")
    .regex(/[^0-9]/, "1 chiffre requis")
    .regex(/[^\w\s]/, "1 caractère spécial requis"),
  
});

export type AuthDTO = z.infer<typeof authSchema>;

const checkLoginDataUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
  
  const data: AuthDTO = result.data;
  (req as any).userValidated = {
    email: data.email,
    password: data.password,
  }
  next();
};

export { checkLoginDataUser };
