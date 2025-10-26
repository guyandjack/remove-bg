
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import JSON resources
import frTranslate from '../content/fr/translateFR.json';
import enTranslate from '../content/en/translateEN.json';

// Normalize resources to a consistent shape

const resources = {
  fr: {
    translation: frTranslate as Record<string, unknown>,
  },
  en: {
    translation: enTranslate as Record<string, unknown>,
  },
} as const;

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    // Using a single default namespace
    defaultNS: 'translation',
    ns: ['translation'],
    returnNull: false,
    returnEmptyString: false,
  });

export default i18n;
