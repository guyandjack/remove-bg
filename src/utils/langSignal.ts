// lang-signal.ts
import { signal, effect } from "@preact/signals";
import i18n from "../translate/function/i18next"; // ton instance i18next initialisée ailleurs

// Signal global
export const langSignal = signal<string>(
  localStorage.getItem("lang") ||
    (navigator.languages?.[0] || navigator.language || "en").split("-")[0]
);

// Quand le signal change → on informe i18next
effect(() => {
  const lang = langSignal.value;
  i18n.changeLanguage(lang); // 🔥 déclenche la traduction
  try {
    localStorage.setItem("lang", lang);
  } catch {}
  document.documentElement.lang = lang;
});

// Quand i18next change (par ex. via useTranslation quelque part) → on met à jour le signal
i18n.on("languageChanged", (lng) => {
  if (langSignal.value !== lng) langSignal.value = lng;
});
