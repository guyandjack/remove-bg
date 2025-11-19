import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const authSchema = z.object({
  email: z.email("email invalide").trim().toLowerCase(),
});

export type AuthDTO = z.infer<typeof authSchema>;

const checkForgotPassword = (
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
    
  };
  next();
};

export { checkForgotPassword };
