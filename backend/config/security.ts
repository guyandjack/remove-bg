const DEFAULT_TRUSTED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://preprod.wizpix.ch",
  "https://api.preprod.wizpix.ch",
  "https://wizpix.ch",
  "https://api.wizpix.ch",
];

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseConfiguredOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));
}

const configuredOrigins = parseConfiguredOrigins(process.env.ALLOWED_ORIGINS);
const trustedOriginSet = new Set([...DEFAULT_TRUSTED_ORIGINS, ...configuredOrigins]);

export const trustedOrigins = [...trustedOriginSet];

export function isTrustedOrigin(origin: string): boolean {
  return trustedOriginSet.has(origin);
}
