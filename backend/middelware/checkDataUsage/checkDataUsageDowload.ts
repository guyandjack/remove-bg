import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

/**
 * Schéma Zod du formulaire de contact
 */
export const contactSchema = z.object({
  reason: z.enum(["download"]),
});

export type ContactDTO = z.infer<typeof contactSchema>;

/**
 * Middleware de validation/normalisation du requete axios.
 * En cas de succès → injecte req.contactValidated
 */
const checkDataUsageDownload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: true,
      message: "Données invalides.",
      issues: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      requestId: (req as any).requestId,
    });
  }

  const data: ContactDTO = parsed.data;

  // Stocke la version propre pour le contrôleur
    (req as any).payload = { ...(req as any).payload , reason: data.reason };
    console.log("req payload  dans checkdataUsage: ", (req as any).payload);

  next();
};

export { checkDataUsageDownload };
