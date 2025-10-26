// src/controllers/mail.controller.ts
import type { RequestHandler } from "express";
import nodemailer, { TransportOptions } from "nodemailer";
import "dotenv/config";

/** Utilitaire: lit une variable d'env, avec fallback et/ou obligation */
function env(name: string, opts?: { required?: boolean; fallback?: string }) {
  const val = process.env[name] ?? opts?.fallback;
  if (opts?.required && (val === undefined || val === "")) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val!;
}

/** Échappe basiquement le HTML pour le body (évite l'injection/affichage cassé) */
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ContactValidated = {
  lastname: string;
  firstname: string;
  email: string;
  subject: string;
  message: string;
  agree?: boolean;
};

/** Handler Express */
const sendContactEmail: RequestHandler = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";

  try {
    // On part du principe que tu as déjà validé et attaché les données ici:
    const { lastname, firstname, email, subject, message } = (req as any)
      .contactValidated as ContactValidated;

    // Nom lisible de l'expéditeur (dans l'en-tête "From")
    const displayName =
      env("MAIL_SENDER_NAME", { fallback: "Contact Form" }) || "Contact Form";

    // ----- Config transport -----
    let transportConfig: TransportOptions;

    if (isProd) {
      // SMTP dédié (prod)
      const host =
        env("MAILBOX_PROD_HOST", { required: true }) || "smtp.yourhost.com";
      const port = Number(env("MAILBOX_PROD_PORT", { fallback: "587" }));
      const user =
        env("MAILBOX_PROD_ADDRESS", {
          // accepte aussi l'ancienne clé mal orthographiée
          fallback: process.env.MAILBOX_PROD_ADRESS,
        }) || env("MAILBOX_PROD_ADRESS", { required: true }); // si seule l'ancienne existe
      const pass = env("MAILBOX_PROD_PASSWORD", { required: true });

      transportConfig = {
        host,
        port,
        secure: port === 465, // 465 = SMTPS
        auth: { user, pass },
      };
    } else {
      // Dev: Gmail (via mot de passe d'appli)
      const user =
        env("MAILBOX_DEV_ADDRESS", {
          fallback: process.env.MAILBOX_DEV_ADRESS,
        }) || env("MAILBOX_DEV_ADRESS", { required: true });
      const pass = env("MAILBOX_DEV_PASSWORD", { required: true });

      // Tu peux utiliser `service: 'gmail'`, mais `host` explicite est souvent plus prévisible
      transportConfig = {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false, // <--- ici
        },
      };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    // Optionnel mais pratique pour diagnostiquer la config
    await transporter.verify();

    // Adresse d’envoi et de réception (la boîte authentifiée)
    const emailFrom =
      (isProd
        ? process.env.MAILBOX_PROD_ADDRESS || process.env.MAILBOX_PROD_ADRESS
        : process.env.MAILBOX_DEV_ADDRESS || process.env.MAILBOX_DEV_ADRESS) ??
      "";
    if (!emailFrom) {
      throw new Error(
        "No sender mailbox configured (MAILBOX_*_ADDRESS / MAILBOX_*_ADRESS)."
      );
    }
    const emailTo = emailFrom; // on envoie vers la même boîte (classique pour un formulaire de contact)

    const fullName = [firstname, lastname].filter(Boolean).join(" ").trim();
    const safeMessage = escapeHtml(message ?? "");
    const safeSubject = subject?.trim() || "Contact form";

    const mailOptions = {
      from: `"${displayName}" <${emailFrom}>`, // l’adresse authentifiée
      to: emailTo,
      replyTo: email, // permet de répondre directement à l’émetteur réel
      subject: `Contact: ${safeSubject}`,
      text:
        `New contact form submission\n\n` +
        `Name: ${fullName}\n` +
        `Email: ${email}\n` +
        `Subject: ${safeSubject}\n\n` +
        `Message:\n${message}\n`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap">${safeMessage}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      status: "success",
      user: firstname,
    });
  } catch (err: any) {
    // Log côté serveur
    console.error("Email sending error:", err);

    // Réponses plus parlantes (sans leak d’infos sensibles)
    res.status(500).json({
      status: "error",
      message: "Email sending error. Please try again later.",
      details:
        process.env.NODE_ENV === "development"
          ? String(err?.message || err)
          : undefined,
    });
  }
};

export {sendContactEmail}
