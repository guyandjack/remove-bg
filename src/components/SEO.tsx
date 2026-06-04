import { Helmet } from "react-helmet-async";
import { useLocation } from "preact-iso";
import { useTranslation } from "react-i18next";

import defaultOgImageUrl from "@/assets/images/logo/logo_9.svg";
import { localOrProd } from "@/utils/localOrProd";

import { seoNoIndexPaths } from "@/data/seoPageIndex/seoPageIndex";

type SEOContent = {
  title: string;
  description: string;
  /**
   * Optional absolute or relative URL for OpenGraph/Twitter images.
   * If omitted, a default image is used.
   */
  imageUrl?: string;
  /**
   * Optional robots meta value.
   * Defaults to "index,follow".
   */
  robots?: string;
};

function normalizeBaseUrl(url: string): string {
  return (url || "").trim().replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  const trimmed = (path || "/").trim();
  if (!trimmed || trimmed === "/") return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function toAbsoluteUrl(baseUrl: string, inputUrl: string): string {
  try {
    return new URL(inputUrl, `${baseUrl}/`).toString();
  } catch {
    return inputUrl;
  }
}

function buildCanonicalUrl(baseUrl: string, path: string): string {
  return toAbsoluteUrl(normalizeBaseUrl(baseUrl), normalizePath(path));
}

function sanitizeMetaText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const NO_INDEX_PATHS = new Set(seoNoIndexPaths.map((path) => normalizePath(path)));
const NO_INDEX_PREFIXES = new Set(["api", "preprod"]);

function startsWithNoIndexPrefix(path: string): boolean {
  const normalizedPath = normalizePath(path);
  const firstSegment = normalizedPath.split("/").filter(Boolean)[0] || "";
  return NO_INDEX_PREFIXES.has(firstSegment.toLowerCase());
}

function isNoIndexPath(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return (
    NO_INDEX_PATHS.has(normalizedPath) || startsWithNoIndexPrefix(normalizedPath)
  );
}

function SEO({ content }: { content: SEOContent }) {
  const { i18n } = useTranslation();
  const { path } = useLocation();

  const baseUrl = normalizeBaseUrl(localOrProd().url);
  const language = (i18n.resolvedLanguage || i18n.language || "en").trim();

  const title = sanitizeMetaText(content.title);
  const description = sanitizeMetaText(content.description);
  const normalizedPath = normalizePath(path);
  const defaultRobots = isNoIndexPath(normalizedPath)
    ? "noindex,follow"
    : "index,follow";
  const robots = sanitizeMetaText(content.robots || defaultRobots);

  const canonicalUrl = buildCanonicalUrl(baseUrl, normalizedPath);

  const ogImage = toAbsoluteUrl(baseUrl, content.imageUrl || defaultOgImageUrl);

  return (
    <Helmet
      htmlAttributes={{
        lang: language,
      }}
    >
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />

      {/* Canonical unique par page (pas de "alternate/hreflang") car les traductions sont dynamiques sans changer l'URL. */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="WizPix" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}

export type { SEOContent };
export { SEO };
