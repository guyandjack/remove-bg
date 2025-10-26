import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

/**
 * Constantes ajustables selon ton besoin
 */
const NAME_MIN = 2;
const NAME_MAX = 30;
const SUBJECT_MIN = 2;
const SUBJECT_MAX = 50;
const MESSAGE_MIN = 8;
const MESSAGE_MAX = 2000; // ← augmente si tu veux

/**
 * Helpers de normalisation
 * - trim
 * - remplace espaces consécutifs par un seul
 */
const normalize = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Autorise lettres Unicode + espaces + apostrophes + tirets
 * (ex: Jean-Pierre D'Amour, Étienne, João…)
 */
const NAME_REGEX = /^[\p{L}][\p{L}\p{M}' -]*$/u;

/**
 * Sujet : lettres/chiffres de base + espaces + apostrophes + tirets
 * (interdit ponctuation exotique)
 */
const SUBJECT_REGEX = /^[\p{L}\p{M}0-9' -]+$/u;

/**
 * Schéma Zod du formulaire de contact
 */
export const contactSchema = z.object({
  lastname: z
    .string("Le nom est requis.")
    .min(NAME_MIN, `Le nom doit contenir au moins ${NAME_MIN} caractères.`)
    .max(NAME_MAX, `Le nom ne doit pas dépasser ${NAME_MAX} caractères.`)
    .regex(
      NAME_REGEX,
      "Le nom ne doit contenir que des lettres, espaces, apostrophes ou tirets."
    )
    .transform(normalize),

  firstname: z
    .string("Le prénom est requis.")
    .min(NAME_MIN, `Le prénom doit contenir au moins ${NAME_MIN} caractères.`)
    .max(NAME_MAX, `Le prénom ne doit pas dépasser ${NAME_MAX} caractères.`)
    .regex(
      NAME_REGEX,
      "Le prénom ne doit contenir que des lettres, espaces, apostrophes ou tirets."
    )
    .transform(normalize),

  email: z.email("Email invalide.").transform((s) => s.trim().toLowerCase()),

  subject: z
    .string("Le sujet est requis.")
    .min(
      SUBJECT_MIN,
      `Le sujet doit contenir au moins ${SUBJECT_MIN} caractères.`
    )
    .max(
      SUBJECT_MAX,
      `Le sujet ne doit pas dépasser ${SUBJECT_MAX} caractères.`
    )
    .regex(
      SUBJECT_REGEX,
      "Le sujet ne doit pas contenir de caractères spéciaux."
    )
    .transform(normalize),

  message: z
    .string("Le message est requis.")
    .min(
      MESSAGE_MIN,
      `Le message doit contenir au moins ${MESSAGE_MIN} caractères.`
    )
    .max(
      MESSAGE_MAX,
      `Le message ne doit pas dépasser ${MESSAGE_MAX} caractères.`
    )
    .transform((s) => s.trim()),
  agree: z
  .boolean("cgu non acceptées")
});

export type ContactDTO = z.infer<typeof contactSchema>;

/**
 * Middleware de validation/normalisation du formulaire de contact.
 * En cas de succès → injecte req.contactValidated
 */
const  checkDataFormContact = (
  req: Request,
  res: Response,
  next: NextFunction
)=> {
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
  (req as any).contactValidated = {
    lastname: data.lastname,
    firstname: data.firstname,
    email: data.email,
    subject: data.subject,
    message: data.message,
    agree:data.agree
  };

  next();
}

export {checkDataFormContact}
