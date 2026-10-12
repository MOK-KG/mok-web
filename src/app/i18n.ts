import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import ky from '@/locales/ky.json';
import ru from '@/locales/ru.json';
import { defaultLanguage, type Language, languages } from '@/shared/config/i18n';
import { storage } from '@/shared/lib/storage';

const LANGUAGE_KEY = 'nok.language';

const saved = storage.get(LANGUAGE_KEY);
const initial: Language = languages.includes(saved as Language)
  ? (saved as Language)
  : defaultLanguage;

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    ky: { translation: ky },
    en: { translation: en },
  },
  lng: initial,
  fallbackLng: defaultLanguage,
  supportedLngs: languages,
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  storage.set(LANGUAGE_KEY, lng);
  document.documentElement.lang = lng;
});
document.documentElement.lang = initial;

export default i18n;
