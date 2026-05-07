import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { validationRegex, toRegExp } from "../../shared/validationRegex.js";

export const authSchema = z.object({
  otp: z.string().regex(toRegExp(validationRegex.otp6), "Code invalide"),
  email: z.email(),
});

export type AuthDTO = z.infer<typeof authSchema>;

const checkSignUpOtpUser = (req: Request, res: Response, next: NextFunction) => {
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
    otp: data.otp,
    email: data.email,
  };
  next();
};

export { checkSignUpOtpUser };

