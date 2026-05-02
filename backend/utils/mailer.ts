import nodemailer from "nodemailer";
import { logger } from "../logger.ts";

export function createSmtpTransporter(isProd: boolean) {
  const from = (
    isProd
      ? process.env.MAILBOX_PROD_ADDRESS || process.env.MAILBOX_PROD_ADRESS
      : process.env.MAILBOX_DEV_ADDRESS || process.env.MAILBOX_DEV_ADRESS
  ) as string | undefined;
  const pass = (
    isProd ? process.env.MAILBOX_PROD_PASSWORD : process.env.MAILBOX_DEV_PASSWORD
  ) as string | undefined;

  if (!from || !pass) return null;

  const host = isProd ? process.env.MAILBOX_PROD_HOST : "smtp.gmail.com";
  const port = isProd ? Number(process.env.MAILBOX_PROD_PORT || 465) : 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: true,
    auth: { user: from, pass },
    tls: { rejectUnauthorized: false },
  });

  transporter.verify().catch((e) => {
    logger.warn("SMTP verify failed", { err: String(e) });
  });

  return transporter;
}

export function resolveMailSender(isProd: boolean): string {
  const sender = (isProd
    ? process.env.MAILBOX_PROD_ADDRESS || process.env.MAILBOX_PROD_ADRESS
    : process.env.MAILBOX_DEV_ADDRESS || process.env.MAILBOX_DEV_ADRESS) ?? "";
  return String(sender || "");
}

export function resolveMailAppName(): string {
  return process.env.MAIL_SENDER_NAME || "Wizard Pixel";
}

