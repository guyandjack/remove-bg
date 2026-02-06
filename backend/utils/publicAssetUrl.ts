import type { Request } from "express";

const trimTrailingSlash = (input: string): string =>
  input.replace(/\/+$/, "");

const trimLeadingSlash = (input: string): string =>
  input.replace(/^\/+/, "");

const gatherBaseUrlCandidates = (isProd: boolean): Array<string | undefined> => [
  process.env.EMAIL_ASSET_BASE_URL,
  isProd ? process.env.BASE_URL_PROD : process.env.BASE_URL_DEV,
  isProd ? process.env.VITE_API_PROD_URL : process.env.VITE_API_DEV_URL,
  isProd ? process.env.DOMAIN_URL_PROD : process.env.DOMAIN_URL_DEV,
];

const fallbackFromRequest = (req: Request | null | undefined, isProd: boolean): string | null => {
  if (!req) return null;
  const host = req.get("host");
  if (!host) return null;
  const protoHeader = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const protocol = protoHeader || req.protocol || (isProd ? "https" : "http");
  return `${protocol}://${host}`;
};

export const buildPublicAssetUrl = (
  relativePath: string,
  opts: { req?: Request | null; isProd: boolean }
): string => {
  const candidates = gatherBaseUrlCandidates(opts.isProd)
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const base =
    candidates[0] ||
    fallbackFromRequest(opts.req, opts.isProd) ||
    (opts.isProd ? "https://api.bgremoved.ch" : "http://localhost:3000");

  const normalizedBase = trimTrailingSlash(base);
  const normalizedPath = trimLeadingSlash(relativePath);
  return `${normalizedBase}/${normalizedPath}`;
};

export const buildLogoUrl = (opts: { req?: Request | null; isProd: boolean }) =>
  buildPublicAssetUrl("public/logo/logo_9_white.svg", opts);
