import { fixedHolidays, type HolidayKey, years } from '@/shared/config/workCalendar';

/**
 * Работа с датами по производственному календарю КР.
 *
 * Даты — строки 'YYYY-MM-DD' (IsoDate) без времени и часового пояса: так дата не «съезжает»
 * на сутки при переводе между поясами. «Сегодня» считается по Бишкеку (UTC+6).
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

export type IsoDate = string;

export type DayKind =
  | { kind: 'working'; shortened: boolean }
  | { kind: 'weekend' }
  | { kind: 'holiday'; holiday: HolidayKey };

const DAY_MS = 86_400_000;
/** Бишкек: UTC+6 круглый год, без перехода на летнее время */
const BISHKEK_OFFSET_MS = 6 * 3_600_000;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** IsoDate → полночь UTC этого дня */
function toUtc(date: IsoDate): number {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`Ожидалась дата 'YYYY-MM-DD', получено: ${date}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (fromUtc(ms) !== date) throw new Error(`Несуществующая дата: ${date}`);
  return ms;
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Сегодняшняя дата в Бишкеке */
export function todayInBishkek(now: Date = new Date()): IsoDate {
  return fromUtc(now.getTime() + BISHKEK_OFFSET_MS);
}

/** Дата + n календарных дней */
export function addDays(date: IsoDate, n: number): IsoDate {
  return fromUtc(toUtc(date) + n * DAY_MS);
}

/** Разница в календарных днях: to − from */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Есть ли в календаре утверждённые данные на год (с датами Орозо айт и Курман айт) */
export function isYearKnown(year: number): boolean {
  return year in years;
}

/** Тип дня: рабочий (возможно, сокращённый), выходной или праздник */
export function dayKind(date: IsoDate): DayKind {
  const year = Number(date.slice(0, 4));
  const monthDay = date.slice(5);
  const data = years[year];
  const holiday = (data?.holidays ?? fixedHolidays)[monthDay];
  if (holiday) return { kind: 'holiday', holiday };

  const weekday = new Date(toUtc(date)).getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;
  if (isWeekend && !data?.workingWeekends.includes(monthDay)) return { kind: 'weekend' };

  return { kind: 'working', shortened: data?.shortened.includes(monthDay) ?? false };
}

export function isWorkingDay(date: IsoDate): boolean {
  return dayKind(date).kind === 'working';
}

/** Ближайший рабочий день, начиная с самой даты */
export function nextWorkingDay(date: IsoDate): IsoDate {
  let d = date;
  for (let i = 0; i < 366; i++) {
    if (isWorkingDay(d)) return d;
    d = addDays(d, 1);
  }
  throw new Error(`Не найден рабочий день после ${date}`);
}

/**
 * Дата через n рабочих дней (n ≥ 0). Сам день старта не считается:
 * addWorkingDays(пятница, 1) → понедельник.
 */
export function addWorkingDays(date: IsoDate, n: number): IsoDate {
  if (!Number.isInteger(n) || n < 0) throw new Error(`n должно быть целым ≥ 0, получено: ${n}`);
  let d = date;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (isWorkingDay(d)) left--;
  }
  return d;
}

/** Число рабочих дней в периоде (from, to]: старт не считается, конец считается */
export function workingDaysBetween(from: IsoDate, to: IsoDate): number {
  const sign = diffDays(from, to) < 0 ? -1 : 1;
  const [a, b] = sign > 0 ? [from, to] : [to, from];
  let count = 0;
  for (let d = addDays(a, 1); diffDays(d, b) >= 0; d = addDays(d, 1)) {
    if (isWorkingDay(d)) count++;
  }
  return count * sign;
}

export type DeadlineState =
  | { state: 'overdue'; days: number }
  | { state: 'today' }
  | { state: 'upcoming'; days: number };

/**
 * Состояние срока относительно сегодняшней даты.
 * «Просрочено N дней» возможно только для даты в прошлом — дата в будущем всегда 'upcoming'.
 * days — календарные дни.
 */
export function deadlineState(deadline: IsoDate, today: IsoDate = todayInBishkek()): DeadlineState {
  const diff = diffDays(today, deadline);
  if (diff < 0) return { state: 'overdue', days: -diff };
  if (diff === 0) return { state: 'today' };
  return { state: 'upcoming', days: diff };
}

/** Срок можно ставить только на рабочий день */
export function isValidDeadline(date: IsoDate): boolean {
  return isWorkingDay(date);
}
