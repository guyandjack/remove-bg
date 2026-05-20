// lang-signal.ts
import { signal, effect } from "@preact/signals";
import i18n from "../translate/function/i18next";

export const langSignal = signal<string>(
  typeof window !== "undefined"
    ? localStorage.getItem("lang") ||
        (navigator.languages?.[0] || navigator.language || "en").split("-")[0]
    : "fr",
);

effect(() => {
  const lang = langSignal.value;

  i18n.changeLanguage(lang);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("lang", lang);
    } catch {}

    document.documentElement.lang = lang;
  }
});

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng) => {
    if (langSignal.value !== lng) {
      langSignal.value = lng;
    }
  });
}
