import { describe, expect, it } from 'vitest';
import i18n from '@/app/i18n';
import { formatIsoDate } from './date';

describe('форматирование дат и сроков', () => {
  it('IsoDate с днём недели, без сдвига по часовому поясу', () => {
    expect(formatIsoDate('2026-10-12', 'EEEEEE, d MMMM yyyy', 'ru')).toBe('пн, 12 октября 2026');
    expect(formatIsoDate('2026-10-12', 'EEE, d MMM yyyy', 'en')).toBe('Mon, 12 Oct 2026');
  });

  it('формы числа в русском', async () => {
    await i18n.changeLanguage('ru');
    const t = (count: number) => i18n.t('deadline.overdue', { count });
    expect(t(1)).toBe('Просрочено на 1 день');
    expect(t(3)).toBe('Просрочено на 3 дня');
    expect(t(5)).toBe('Просрочено на 5 дней');
    expect(t(21)).toBe('Просрочено на 21 день');
    expect(i18n.t('deadline.left', { count: 2 })).toBe('Осталось 2 дня');
  });

  it('формы числа в английском', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('deadline.overdue', { count: 1 })).toBe('Overdue by 1 day');
    expect(i18n.t('deadline.overdue', { count: 4 })).toBe('Overdue by 4 days');
    await i18n.changeLanguage('ru');
  });
});
