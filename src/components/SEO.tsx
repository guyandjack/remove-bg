import { Helmet } from "react-helmet-async";
import { useLocation } from "preact-iso";
import { useTranslation } from "react-i18next";

import defaultOgImageUrl from "@/assets/images/logo/logo_9.svg";
import { localOrProd } from "@/utils/localOrProd";

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

type HreflangSpec = {
  hrefLang: "fr-CH" | "en" | "de-CH" | "it-CH" | "x-default";
  /**
   * i18next language code used in URL. Keep it aligned with supported languages.
   */
  langParam: string;
};

const HREFLANGS: HreflangSpec[] = [
  { hrefLang: "fr-CH", langParam: "fr" },
  { hrefLang: "en", langParam: "en" },
  // Ces deux variantes sont demandées côté SEO; tant que l'UI n'est pas traduite,
  // elles serviront de cible "lang" pour une future extension i18n.
  { hrefLang: "de-CH", langParam: "de" },
  { hrefLang: "it-CH", langParam: "it" },
  { hrefLang: "x-default", langParam: "en" },
];

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

function buildPageUrl(baseUrl: string, path: string, langParam: string): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl) || ""}${normalizePath(path)}`);
  if (langParam) url.searchParams.set("lang", langParam);
  return url.toString();
}

function sanitizeMetaText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function SEO({ content }: { content: SEOContent }) {
  const { i18n } = useTranslation();
  const { path } = useLocation();

  const baseUrl = normalizeBaseUrl(localOrProd().url);
  const language = (i18n.resolvedLanguage || i18n.language || "en").trim();

  const title = sanitizeMetaText(content.title);
  const description = sanitizeMetaText(content.description);
  const robots = sanitizeMetaText(content.robots || "index,follow");

  const canonicalUrl = buildPageUrl(baseUrl, path, language);
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

      {/* hreflang */}
      {HREFLANGS.map(({ hrefLang, langParam }) => (
        <link
          key={hrefLang}
          rel="alternate"
          hrefLang={hrefLang}
          href={buildPageUrl(baseUrl, path, langParam)}
        />
      ))}
    </Helmet>
  );
}

export type { SEOContent };
export { SEO };

