export const languages = ['ru', 'ky', 'en'] as const;

export type Language = (typeof languages)[number];

export const defaultLanguage: Language = 'ru';

export const languageLabels: Record<Language, string> = {
  ru: 'Русский',
  ky: 'Кыргызча',
  en: 'English',
};
