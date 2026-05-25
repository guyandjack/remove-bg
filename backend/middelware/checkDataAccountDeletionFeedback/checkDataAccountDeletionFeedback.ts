import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../../logger.js";

const TOKEN_HEX_64 = /^[a-f0-9]{64}$/;

const reasonsSchema = z
  .object({
    expensive: z.boolean().optional(),
    no_more_use: z.boolean().optional(),
    bad_quality_result: z.boolean().optional(),
    difficult: z.boolean().optional(),
    bad_UX: z.boolean().optional(),
    found_alternative: z.boolean().optional(),
    other: z.boolean().optional(),
  })
  .strict();

export const accountDeletionFeedbackSchema = z
  .object({
    token: z
      .string({ message: "token requis" })
      .trim()
      .regex(TOKEN_HEX_64, "token invalide"),
    reasons: reasonsSchema,
    other_text: z
      .string()
      .trim()
      .max(2000, "Texte trop long")
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    const reasons = data.reasons || {};
    const hasAnyReason = Object.values(reasons).some((v) => v === true);
    const otherText = typeof data.other_text === "string" ? data.other_text.trim() : "";
    const hasOtherText = otherText.length >= 3;

    if (!hasAnyReason && !hasOtherText) {
      ctx.addIssue({
        code: "custom",
        path: ["reasons"],
        message: "Merci de séléctionner au moins une raison ou d'ajouter un commentaire.",
      });
    }

    if (reasons.other === true && !hasOtherText) {
      ctx.addIssue({
        code: "custom",
        path: ["other_text"],
        message: "Merci de préciser la raison.",
      });
    }
  });

export type AccountDeletionFeedbackDTO = z.infer<typeof accountDeletionFeedbackSchema>;

const checkDataAccountDeletionFeedback = (req: Request, res: Response, next: NextFunction) => {
  const parsed = accountDeletionFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("checkDataAccountDeletionFeedback::invalid_body", {
      code: "mw_checkDataAccountDeletionFeedback_err1",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      issues: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return res.status(400).json({
      error: true,
      message: "Données invalides.",
      issues: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      code: "mw_checkDataAccountDeletionFeedback_err1",
      requestId: (req as any).requestId,
    });
  }

  (req as any).deletionFeedbackValidated = parsed.data as AccountDeletionFeedbackDTO;
  next();
};

export { checkDataAccountDeletionFeedback };
