import axios from "axios";
import type { Request } from "express";
import { logger } from "../logger.ts";

const TELEGRAM_ENDPOINT = "https://api.telegram.org";
const TELEGRAM_SPECIAL_CHARS = /[_*\[\]\(\)~`>#+\-=|{}\.!]/g;

const escapeMarkdownV2 = (input: string): string => {
  if (!input) {
    return "";
  }
  return input.replace(TELEGRAM_SPECIAL_CHARS, "\\$&");
};

const anonymizeIp = (ip?: string | null): string => {
  if (!ip) {
    return "inconnue";
  }
  if (ip.includes(":")) {
    const segments = ip.split(":").filter(Boolean);
    if (segments.length <= 2) {
      return `${segments.join(":")}:xxxx`;
    }
    return `${segments.slice(0, 4).join(":")}:xxxx`;
  }
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  return ip;
};

const resolveClientIp = (req: Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]!;
  }
  if (req.ip) {
    return req.ip;
  }
  const socketIp =
    (req.connection as any)?.remoteAddress ??
    (req.socket as any)?.remoteAddress ??
    (req as any)?.infos?.ip;
  return socketIp || "inconnue";
};

const buildContactMessage = (payload: {
  firstname: string;
  lastname: string;
  email: string;
  message: string;
  submittedAt: string;
  ip: string;
  referer?: string | null;
}): string => {
  const safeFirstname = escapeMarkdownV2(payload.firstname || "N/A");
  const safeLastname = escapeMarkdownV2(payload.lastname || "N/A");
  const safeEmail = escapeMarkdownV2(payload.email || "N/A");
  const safeMessage = escapeMarkdownV2(payload.message || "N/A");
  const safeDate = escapeMarkdownV2(payload.submittedAt);
  const safeIp = escapeMarkdownV2(anonymizeIp(payload.ip));

  const lines = [
    escapeMarkdownV2("📬 Nouveau message – Formulaire de contact WizPix"),
    `Nom: ${safeLastname}`,
    `Prénom: ${safeFirstname}`,
    `Email: ${safeEmail}`,
    `Message:\n${safeMessage}`,
    `Date: ${safeDate}`,
    `IP: ${safeIp}`,
  ];

  if (payload.referer) {
    lines.push(`Référent: ${escapeMarkdownV2(payload.referer)}`);
  }

  return lines.join("\n");
};

const buildNewClientMessage = (payload: {
  planCode: string;
  email: string;
  referer?: string | null;
  occurredAt: string;
}): string => {
  const safePlan =
    escapeMarkdownV2(payload.planCode ? payload.planCode.toLowerCase() : "N/A");
  const safeEmail = escapeMarkdownV2(payload.email || "N/A");
  const safeDate = escapeMarkdownV2(payload.occurredAt);

  const lines = [
    escapeMarkdownV2("📬 Nouveau message – Nouveau client WizPix"),
    `Abonnement: ${safePlan}`,
    `Email: ${safeEmail}`,
    `Date: ${safeDate}`,
  ];

  if (payload.referer) {
    lines.push(`Référent: ${escapeMarkdownV2(payload.referer)}`);
  }

  return lines.join("\n");
};

const sendTelegramMessage = async (text: string): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("Telegram configuration is incomplete.");
  }

  const url = `${TELEGRAM_ENDPOINT}/bot${botToken}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text,
    parse_mode: "MarkdownV2",
    disable_web_page_preview: true,
  });
};

const notifyContactSubmission = async (
  req: Request,
  payload: {
    firstname: string;
    lastname: string;
    email: string;
    message: string;
  }
): Promise<void> => {
  const referer = (req.headers.referer as string | undefined) ?? null;
  const submittedAt = new Date().toISOString();
  const clientIp = resolveClientIp(req);
  const message = buildContactMessage({
    firstname: payload.firstname,
    lastname: payload.lastname,
    email: payload.email,
    message: payload.message,
    submittedAt,
    ip: clientIp,
    referer,
  });
  await sendTelegramMessage(message);
};

const notifyNewClientSignup = async (payload: {
  email: string;
  planCode: string;
  referer?: string | null;
  occurredAt?: string;
}): Promise<void> => {
  const occurredAt = payload.occurredAt ?? new Date().toISOString();
  const message = buildNewClientMessage({
    planCode: payload.planCode,
    email: payload.email,
    referer: payload.referer,
    occurredAt,
  });
  await sendTelegramMessage(message);
};

const safeNotify = async (action: () => Promise<void>) => {
  try {
    await action();
  } catch (err: any) {
    logger.warn(
      `[telegram] Notification non envoyée: ${err?.message || String(err)}`
    );
  }
};

export {
  escapeMarkdownV2,
  anonymizeIp,
  resolveClientIp,
  notifyContactSubmission,
  notifyNewClientSignup,
  safeNotify,
};
