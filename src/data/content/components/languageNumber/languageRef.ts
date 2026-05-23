const SUPPORTED_LANGS = ["fr", "en", "de", "it"] as const;

export type AppLang = (typeof SUPPORTED_LANGS)[number];

type LanguageItem = readonly [code: AppLang, label: string];

export const languageRef: readonly LanguageItem[] = [
  ["fr", "Français"],
  ["en", "English"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
] as const;