function normalizeBaseUrl(input: string): string {
  const trimmed = String(input || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
}

/**
 * Returns the publicly reachable base URL for the backend, used to build webhook URLs.
 *
 * Rules (per project conventions):
 * - In development: use REPLICATE_WEBHOOK_URL (tunnel, e.g. localtunnel).
 * - In preprod/prod: use BASE_URL_PROD.
 *
 * Important: This is a "public" URL (reachable by Replicate), not necessarily the internal bind host.
 */
export function getPublicBackendBaseUrl(): string {
  const isDev = process.env.NODE_ENV === "development";
  const candidate = isDev
    ? process.env.REPLICATE_WEBHOOK_URL ?? process.env.BASE_URL_DEV ?? ""
    : process.env.BASE_URL_PROD ?? "";

  return normalizeBaseUrl(candidate);
}

