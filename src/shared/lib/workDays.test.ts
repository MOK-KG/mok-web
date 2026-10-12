import { describe, expect, it } from 'vitest';
import { years } from '@/shared/config/workCalendar';
import {
  addDays,
  addWorkingDays,
  dayKind,
  deadlineState,
  diffDays,
  isValidDeadline,
  isWorkingDay,
  isYearKnown,
  nextWorkingDay,
  todayInBishkek,
  workingDaysBetween,
} from './workDays';

const monthDays = (year: number, month: number) => {
  const days: string[] = [];
  const mm = String(month).padStart(2, '0');
  for (let d = `${year}-${mm}-01`; d.slice(5, 7) === mm; d = addDays(d, 1)) days.push(d);
  return days;
};

describe('производственный календарь 2026', () => {
  // «Норма рабочего времени на 2026 год», приложение 2 к приказу Минтруда № 330.
  // Норма считается без Орозо айт и Курман айт — сверяем без них.
  const officialWorkingDays = [17, 20, 22, 22, 15, 22, 23, 20, 22, 22, 21, 23];
  const lunar = new Set(['2026-03-20', '2026-05-27']);

  it('число рабочих дней по месяцам совпадает с нормой Минтруда', () => {
    const counted = officialWorkingDays.map(
      (_, i) => monthDays(2026, i + 1).filter((d) => lunar.has(d) || isWorkingDay(d)).length,
    );
    expect(counted).toEqual(officialWorkingDays);
  });

  it('годовая норма часов при 40-часовой неделе — 1987', () => {
    // Сокращённые дни −1 час; 20 марта было сокращённым до объявления Орозо айт
    const shortened = new Set([...years[2026].shortened.map((md) => `2026-${md}`), '2026-03-20']);
    const hours = Array.from({ length: 12 }, (_, i) => monthDays(2026, i + 1))
      .flat()
      .filter((d) => lunar.has(d) || isWorkingDay(d))
      .reduce((sum, d) => sum + (shortened.has(d) ? 7 : 8), 0);
    expect(hours).toBe(1987);
  });

  it('с учётом айтов: в марте 21 рабочий день, в мае — 14', () => {
    expect(monthDays(2026, 3).filter(isWorkingDay)).toHaveLength(21);
    expect(monthDays(2026, 5).filter(isWorkingDay)).toHaveLength(14);
  });

  it('праздник на выходном не переносится: 8 марта — вс, 9 марта — рабочий', () => {
    expect(dayKind('2026-03-08')).toEqual({ kind: 'holiday', holiday: 'womensDay' });
    expect(isWorkingDay('2026-03-09')).toBe(true);
  });

  it('типы дней', () => {
    expect(dayKind('2026-01-07')).toEqual({ kind: 'holiday', holiday: 'christmas' });
    expect(dayKind('2026-05-27')).toEqual({ kind: 'holiday', holiday: 'kurmanAit' });
    expect(dayKind('2026-02-23')).toEqual({ kind: 'working', shortened: true });
    expect(dayKind('2026-10-10')).toEqual({ kind: 'weekend' });
    expect(dayKind('2026-10-12')).toEqual({ kind: 'working', shortened: false });
  });
});

describe('рабочие дни', () => {
  it('пятница + 1 рабочий день = понедельник', () => {
    expect(addWorkingDays('2026-10-09', 1)).toBe('2026-10-12');
  });

  it('майские каникулы пропускаются', () => {
    // 30 апреля (чт) + 1 → 11 мая (пн): 1–9 мая нерабочие, 10 мая — воскресенье
    expect(addWorkingDays('2026-04-30', 1)).toBe('2026-05-11');
  });

  it('+0 рабочих дней — та же дата', () => {
    expect(addWorkingDays('2026-10-10', 0)).toBe('2026-10-10');
  });

  it('следующий рабочий день', () => {
    expect(nextWorkingDay('2026-01-01')).toBe('2026-01-08');
    expect(nextWorkingDay('2026-10-12')).toBe('2026-10-12');
  });

  it('рабочих дней между датами, в обе стороны', () => {
    expect(workingDaysBetween('2026-10-09', '2026-10-16')).toBe(5);
    expect(workingDaysBetween('2026-10-16', '2026-10-09')).toBe(-5);
    expect(workingDaysBetween('2026-10-12', '2026-10-12')).toBe(0);
  });

  it('срок только на рабочий день', () => {
    expect(isValidDeadline('2026-10-11')).toBe(false);
    expect(isValidDeadline('2026-08-31')).toBe(false);
    expect(isValidDeadline('2026-10-13')).toBe(true);
  });
});

describe('сроки', () => {
  it('дата в будущем никогда не «просрочена»', () => {
    expect(deadlineState('2026-10-20', '2026-10-12')).toEqual({ state: 'upcoming', days: 8 });
  });

  it('просрочка и «сегодня»', () => {
    expect(deadlineState('2026-10-09', '2026-10-12')).toEqual({ state: 'overdue', days: 3 });
    expect(deadlineState('2026-10-12', '2026-10-12')).toEqual({ state: 'today' });
  });

  it('переход через год и високосный февраль', () => {
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
    expect(diffDays('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('часовой пояс и формат', () => {
  it('сегодня по Бишкеку (UTC+6): 19:00 UTC — уже следующий день', () => {
    expect(todayInBishkek(new Date('2026-10-12T17:59:00Z'))).toBe('2026-10-12');
    expect(todayInBishkek(new Date('2026-10-12T18:00:00Z'))).toBe('2026-10-13');
  });

  it('неверные даты отклоняются', () => {
    expect(() => isWorkingDay('2026-02-30')).toThrow();
    expect(() => isWorkingDay('12.10.2026')).toThrow();
  });

  it('год без утверждённого календаря — только фиксированные праздники', () => {
    expect(isYearKnown(2026)).toBe(true);
    expect(isYearKnown(2027)).toBe(false);
    expect(dayKind('2027-01-01')).toEqual({ kind: 'holiday', holiday: 'newYearHolidays' });
    expect(isWorkingDay('2027-01-08')).toBe(true);
  });
});
