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

/**
 * Короткое относительное время для лент: «12 мин», «3 ч», «вчера», «2 дн».
 * Ключи перевода — time.* (формы числа i18next).
 */
export function relativeShort(
  iso: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  now: Date = new Date(),
) {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t('time.now');
  if (minutes < 60) return t('time.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hours', { count: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('time.yesterday') : t('time.days', { count: days });
}

/**
 * Момент времени (ISO) в часовом поясе Бишкека (UTC+6) — независимо от пояса браузера.
 * Например «8 сент, 11:05».
 */
export function formatInBishkek(iso: string, pattern = 'd MMM, HH:mm', lang?: string) {
  const shifted = new Date(Date.parse(iso) + 6 * 3_600_000);
  const local = new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
  );
  // Сокращения месяцев без точки, как в макете: «8 сент, 11:05»
  return format(local, pattern, { locale: localeFor(lang) }).replace(/\.(?=[\s,]|$)/g, '');
}
