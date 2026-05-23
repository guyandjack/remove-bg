import type { Request } from "express";

export const SUPPORTED_LOCALES = ["fr", "en", "de", "it"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function firstHeaderValue(value: unknown): string | null {
  if (Array.isArray(value)) return value.length ? String(value[0] ?? "") : null;
  if (value === undefined || value === null) return null;
  return String(value);
}

/**
 * Normalize an arbitrary locale input to one of the supported locales.
 * Handles:
 * - "fr", "en", "de", "it"
 * - "fr-FR", "en-US", "de_DE"
 * - Accept-Language like: "fr-FR,fr;q=0.9,en;q=0.8"
 */
export function normalizeSupportedLocale(input: unknown): SupportedLocale | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const firstToken = raw.split(",")[0]?.trim() ?? "";
  const withoutQ = firstToken.split(";")[0]?.trim() ?? "";
  const normalized = withoutQ.replace(/_/g, "-").toLowerCase();
  const base = normalized.split("-")[0] ?? "";

  return (SUPPORTED_LOCALES as readonly string[]).includes(base)
    ? (base as SupportedLocale)
    : null;
}

/**
 * Single source of truth for picking the email/template locale from an HTTP request.
 * Priority order (most explicit -> least):
 * 1) `x-app-locale` header (sent by frontend i18next)
 * 2) body `lang` / `locale` / `language`
 * 3) query `lang` / `locale`
 * 4) `accept-language` header
 * Fallback: "en"
 */
export function resolveRequestLocale(req: Request): SupportedLocale {
  const headerLocale = normalizeSupportedLocale(firstHeaderValue(req.headers["x-app-locale"]));
  if (headerLocale) return headerLocale;

  const bodyAny = (req as any)?.body ?? {};
  const bodyLocale =
    normalizeSupportedLocale(bodyAny?.lang) ??
    normalizeSupportedLocale(bodyAny?.locale) ??
    normalizeSupportedLocale(bodyAny?.language);
  if (bodyLocale) return bodyLocale;

  const queryAny = (req as any)?.query ?? {};
  const queryLocale =
    normalizeSupportedLocale(queryAny?.lang) ?? normalizeSupportedLocale(queryAny?.locale);
  if (queryLocale) return queryLocale;

  const acceptLanguage = normalizeSupportedLocale(firstHeaderValue(req.headers["accept-language"]));
  if (acceptLanguage) return acceptLanguage;

  return "en";
}

