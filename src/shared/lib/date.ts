import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import type { Language } from '@/shared/config/i18n';

// В date-fns нет кыргызской локали — для ky используем русскую
const locales: Record<Language, typeof ru> = { ru, ky: ru, en: enUS };

export const formatDate = (date: Date | number, pattern = 'd MMMM yyyy', lang?: string) =>
  format(date, pattern, { locale: locales[lang as Language] ?? ru });
