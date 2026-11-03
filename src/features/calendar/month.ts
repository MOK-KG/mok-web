import type { HolidayKey } from '@/shared/config/workCalendar';
import { addDays, dayKind, diffDays, type IsoDate, isYearKnown } from '@/shared/lib/workDays';
import { type Absence, isAbsentOn } from '../tasks/absences';
import type { Task } from '../tasks/types';

/**
 * Календарь: сетка месяца по производственному календарю КР, сроки задач и отпуска по дням.
 * Своих событий у календаря пока нет — их нет в модели данных.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

/** Месяц — 'YYYY-MM' */
export type IsoMonth = string;

/** Слои календаря, которые можно скрыть */
export type CalendarLayer = 'mine' | 'department' | 'absences';

export const calendarLayers: CalendarLayer[] = ['mine', 'department', 'absences'];

export const monthOf = (date: IsoDate): IsoMonth => date.slice(0, 7);

export const isIsoMonth = (value: unknown): value is IsoMonth =>
  typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** Соседний месяц: shiftMonth('2026-12', 1) → '2027-01' */
export function shiftMonth(month: IsoMonth, n: number): IsoMonth {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Все дни месяца по порядку */
export function daysOf(month: IsoMonth): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = `${month}-01`; monthOf(d) === month; d = addDays(d, 1)) days.push(d);
  return days;
}

/** День недели: 0 — понедельник … 6 — воскресенье */
export function weekdayOf(date: IsoDate): number {
  // 2024-01-01 — понедельник
  return ((diffDays('2024-01-01', date) % 7) + 7) % 7;
}

/** Сетка месяца неделями с понедельника; дни соседних месяцев дополняют первую и последнюю */
export function monthGrid(month: IsoMonth): IsoDate[][] {
  const days = daysOf(month);
  const start = addDays(days[0], -weekdayOf(days[0]));
  const last = days[days.length - 1];
  const end = addDays(last, 6 - weekdayOf(last));
  const weeks: IsoDate[][] = [];
  for (let d = start; diffDays(d, end) >= 0; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  }
  return weeks;
}

export type DayType =
  | { type: 'working'; shortened: boolean }
  | { type: 'weekend' }
  | { type: 'holiday'; holiday: HolidayKey };

export function dayType(date: IsoDate): DayType {
  const kind = dayKind(date);
  if (kind.kind === 'working') return { type: 'working', shortened: kind.shortened };
  if (kind.kind === 'holiday') return { type: 'holiday', holiday: kind.holiday };
  return { type: 'weekend' };
}

/** Часов в рабочем дне при 40-часовой неделе; сокращённый — на час меньше */
export const WORKDAY_HOURS = 8;

export type MonthNorm = {
  workingDays: number;
  /** Норма часов при 40-часовой неделе */
  hours: number;
  /** Праздничные дни месяца (только нерабочие праздники) */
  holidays: { date: IsoDate; holiday: HolidayKey }[];
  shortened: IsoDate[];
  /** Год внесён по приказу Минтруда; иначе — только фиксированные праздники */
  official: boolean;
};

export function monthNorm(month: IsoMonth): MonthNorm {
  let workingDays = 0;
  let hours = 0;
  const holidays: MonthNorm['holidays'] = [];
  const shortened: IsoDate[] = [];
  for (const date of daysOf(month)) {
    const t = dayType(date);
    if (t.type === 'working') {
      workingDays += 1;
      hours += t.shortened ? WORKDAY_HOURS - 1 : WORKDAY_HOURS;
      if (t.shortened) shortened.push(date);
    } else if (t.type === 'holiday') {
      holidays.push({ date, holiday: t.holiday });
    }
  }
  return {
    workingDays,
    hours,
    holidays,
    shortened,
    official: isYearKnown(Number(month.slice(0, 4))),
  };
}

export type HolidayRange = { holiday: HolidayKey; from: IsoDate; to: IsoDate };

/** Праздники подряд одним отрезком: «Майские каникулы 1–4 мая», «День Конституции 5 мая» */
export function holidayRanges(holidays: MonthNorm['holidays']): HolidayRange[] {
  const ranges: HolidayRange[] = [];
  for (const { date, holiday } of holidays) {
    const last = ranges.at(-1);
    if (last && last.holiday === holiday && diffDays(last.to, date) === 1) last.to = date;
    else ranges.push({ holiday, from: date, to: date });
  }
  return ranges;
}

export type DayEvents = {
  /** Задачи со сроком в этот день */
  deadlines: Task[];
  /** Кто в отпуске в этот день */
  absences: Absence[];
};

/**
 * События по дням для показанных дней: сроки незакрытых задач и отпуска.
 * mine — мои задачи, department — остальные задачи департамента.
 */
export function eventsByDay(
  days: IsoDate[],
  tasks: Task[],
  absences: Absence[],
  layers: ReadonlySet<CalendarLayer>,
  userId: string,
): Map<IsoDate, DayEvents> {
  const result = new Map<IsoDate, DayEvents>();
  // Повторы дней (выбранный день и он же в сетке) не удваивают события
  const shown = new Set(days);
  for (const day of shown) result.set(day, { deadlines: [], absences: [] });

  for (const task of tasks) {
    if (!task.due || task.status === 'done' || !shown.has(task.due)) continue;
    const layer: CalendarLayer = task.assignee?.id === userId ? 'mine' : 'department';
    if (layers.has(layer)) result.get(task.due)?.deadlines.push(task);
  }
  if (layers.has('absences')) {
    for (const day of shown) {
      const events = result.get(day);
      for (const a of absences) if (isAbsentOn(a, day)) events?.absences.push(a);
    }
  }
  // Мои — первыми, дальше по названию
  for (const events of result.values()) {
    events.deadlines.sort(
      (a, b) =>
        Number(b.assignee?.id === userId) - Number(a.assignee?.id === userId) ||
        a.title.localeCompare(b.title, 'ru'),
    );
  }
  return result;
}
