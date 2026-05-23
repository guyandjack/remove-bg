// lang-signal.ts
import { signal, effect } from "@preact/signals";
import i18n from "../translate/function/i18next";

// tu ajouteras l'URL exacte
import { languageRef } from "@/data/content/components/languageNumber/languageRef";

type AppLang = (typeof languageRef)[number][0];

const DEFAULT_LANG: AppLang = "fr";
const STORAGE_KEY = "lang";

const supportedLangs = languageRef.map(([code]) => code);

function isAppLang(lang: string): lang is AppLang {
  return supportedLangs.includes(lang as AppLang);
}

function normalizeLang(lang?: string | null): AppLang {
  const shortLang = lang?.toLowerCase().split("-")[0];

  if (shortLang && isAppLang(shortLang)) {
    return shortLang;
  }

  return DEFAULT_LANG;
}

function getStoredLang(): AppLang | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeLang(stored) : null;
  } catch {
    return null;
  }
}

function getBrowserLang(): AppLang {
  if (typeof window === "undefined") return DEFAULT_LANG;

  const langs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const lang of langs) {
    const shortLang = lang.toLowerCase().split("-")[0];

    if (isAppLang(shortLang)) {
      return shortLang;
    }
  }

  return DEFAULT_LANG;
}

function getInitialLang(): AppLang {
  return getStoredLang() ?? getBrowserLang();
}

export const langSignal = signal<AppLang>(getInitialLang());

export function setUserLang(lang: string) {
  langSignal.value = normalizeLang(lang);
}

effect(() => {
  const lang = langSignal.value;

  const currentLang = normalizeLang(i18n.resolvedLanguage || i18n.language);

  if (currentLang !== lang) {
    i18n.changeLanguage(lang);
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}

    document.documentElement.lang = lang;
  }
});

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    const normalized = normalizeLang(lng);

    if (langSignal.value !== normalized) {
      langSignal.value = normalized;
    }
  });
}
