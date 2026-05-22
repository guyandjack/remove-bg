
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import JSON resources
import frTranslate from '@/translate/content/fr/translateFR.json';
import enTranslate from '@/translate/content/en/translateEN.json';
import deTranslate from '@/translate/content/de/translateDE.json';
import itTranslate from '@/translate/content/it/translateIT.json';
import frSeo from '@/translate/content/fr/seo.json';
import enSeo from '@/translate/content/en/seo.json';
import deSeo from '@/translate/content/de/seo.json';
import itSeo from '@/translate/content/it/seo.json';

// Normalize resources to a consistent shape

const resources = {
  fr: {
    translation: frTranslate as Record<string, unknown>,
    seo: frSeo as Record<string, unknown>,
  },
  en: {
    translation: enTranslate as Record<string, unknown>,
    seo: enSeo as Record<string, unknown>,
  },
  de: {
    translation: deTranslate as Record<string, unknown>,
    seo: deSeo as Record<string, unknown>,
  },
  it: {
    translation: itTranslate as Record<string, unknown>,
    seo: itSeo as Record<string, unknown>,
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
    ns: ['translation', 'seo'],
    returnNull: false,
    returnEmptyString: false,
  });

export default i18n;
