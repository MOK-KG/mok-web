import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import type { Language } from '@/shared/config/i18n';
import type { IsoDate } from './workDays';

// В date-fns нет кыргызской локали — для ky используем русскую
const locales: Record<Language, typeof ru> = { ru, ky: ru, en: enUS };

const localeFor = (lang?: string) => locales[lang as Language] ?? ru;

export const formatDate = (date: Date | number, pattern = 'd MMMM yyyy', lang?: string) =>
  format(date, pattern, { locale: localeFor(lang) });

/**
 * Форматирует IsoDate ('YYYY-MM-DD') без сдвига по часовому поясу.
 * По умолчанию с днём недели: «пт, 13 ноября 2026».
 */
export function formatIsoDate(date: IsoDate, pattern = 'EEEEEE, d MMMM yyyy', lang?: string) {
  const [y, m, d] = date.split('-').map(Number);
  return format(new Date(y, m - 1, d), pattern, { locale: localeFor(lang) });
}
