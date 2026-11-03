import type { HolidayKey } from '@/shared/config/workCalendar';
import {
  addDays,
  dayKind,
  diffDays,
  type IsoDate,
  todayInBishkek,
  workingDaysBetween,
} from '@/shared/lib/workDays';
import { type Absence, isAbsentOn } from '../tasks/absences';
import { urgencyOf } from '../tasks/deadline';
import { sortForList } from '../tasks/list';
import type { Task } from '../tasks/types';

/**
 * Сводка для «Рабочего стола»: что требует внимания сегодня.
 * Каждый счётчик — длина списка, который показывается рядом (CLAUDE.md, «Согласованность чисел»).
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

/** Отпуска, которые начнутся в ближайшие N дней, — в блоке «Кто отсутствует» */
export const UPCOMING_ABSENCE_DAYS = 14;

export type DashboardSummary = {
  /** Мои незакрытые задачи — сначала то, что горит */
  mine: Task[];
  /** Мои просроченные */
  overdue: Task[];
  /** Мои со сроком сегодня или в ближайшие 2 дня */
  soon: Task[];
  /** Поставленные мной и ждущие проверки */
  toReview: Task[];
  /** Незакрытые задачи департамента с эскалацией */
  escalations: Task[];
  /** Сейчас в отпуске */
  absentNow: Absence[];
  /** Уходят в отпуск в ближайшие UPCOMING_ABSENCE_DAYS дней */
  absentSoon: Absence[];
};

export function dashboardSummary(
  tasks: Task[],
  absences: Absence[],
  userId: string,
  today: IsoDate = todayInBishkek(),
): DashboardSummary {
  const active = tasks.filter((t) => t.status !== 'done');
  const mine = sortForList(
    active.filter((t) => t.assignee?.id === userId),
    today,
  );
  const byStart = (a: Absence, b: Absence) => a.from.localeCompare(b.from);
  return {
    mine,
    overdue: mine.filter((t) => urgencyOf(t, today).urgency === 'overdue'),
    soon: mine.filter((t) => urgencyOf(t, today).urgency === 'soon'),
    toReview: active.filter((t) => t.status === 'review' && t.author.id === userId),
    escalations: sortForList(
      active.filter((t) => t.escalationHours !== null),
      today,
    ),
    absentNow: absences.filter((a) => isAbsentOn(a, today)).sort(byStart),
    absentSoon: absences
      .filter((a) => {
        const until = diffDays(today, a.from);
        return until > 0 && until <= UPCOMING_ABSENCE_DAYS;
      })
      .sort(byStart),
  };
}

export type WorkMonth = {
  /** Рабочих дней в месяце по календарю КР */
  total: number;
  /** Осталось, включая сегодня, если сегодня рабочий */
  left: number;
};

/** Рабочие дни месяца, в котором `today` */
export function workMonth(today: IsoDate = todayInBishkek()): WorkMonth {
  const first = `${today.slice(0, 8)}01`;
  const nextMonth = addDays(first, 32).slice(0, 8);
  const last = addDays(`${nextMonth}01`, -1);
  const before = addDays(first, -1);
  return {
    total: workingDaysBetween(before, last),
    left: workingDaysBetween(addDays(today, -1), last),
  };
}

export type NextHoliday = { date: IsoDate; holiday: HolidayKey; days: number };

/** Ближайший праздник после сегодняшнего дня (в пределах года); null — не найден */
export function nextHoliday(today: IsoDate = todayInBishkek()): NextHoliday | null {
  for (let i = 1; i <= 366; i++) {
    const date = addDays(today, i);
    const kind = dayKind(date);
    if (kind.kind === 'holiday') {
      // Многодневные каникулы — с первого дня, а не с середины
      return { date, holiday: kind.holiday, days: i };
    }
  }
  return null;
}

/** Тип сегодняшнего дня — для подписи под приветствием */
export function todayKind(
  today: IsoDate = todayInBishkek(),
): 'working' | 'shortened' | 'weekend' | 'holiday' {
  const kind = dayKind(today);
  if (kind.kind === 'working') return kind.shortened ? 'shortened' : 'working';
  return kind.kind;
}

/** Время суток в Бишкеке для приветствия: утро до 12, день до 18, вечер */
export function partOfDay(now: Date = new Date()): 'morning' | 'day' | 'evening' {
  const hour = (now.getUTCHours() + 6) % 24;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  return 'evening';
}
