import type { HolidayKey } from '@/shared/config/workCalendar';
import {
  dayKind,
  deadlineState,
  diffDays,
  type IsoDate,
  todayInBishkek,
} from '@/shared/lib/workDays';
import type { Task } from './types';

/**
 * Насколько срочна задача — для цвета полосы и метки срока на карточке (макет Figma):
 * - overdue — срок прошёл (красный);
 * - soon — сегодня или в ближайшие 2 дня (жёлтый, «11 сент · 2 дня»);
 * - week — в ближайшие 7 дней (синий);
 * - later — позже (нейтральный);
 * - none — без срока.
 * Готовые задачи сроком не подсвечиваются.
 */
export type Urgency = 'overdue' | 'soon' | 'week' | 'later' | 'none';

export const SOON_DAYS = 2;
export const WEEK_DAYS = 7;

export function urgencyOf(task: Pick<Task, 'due' | 'status'>, today: IsoDate = todayInBishkek()) {
  if (!task.due) return { urgency: 'none' as const, days: 0 };
  if (task.status === 'done') return { urgency: 'later' as const, days: 0 };
  const state = deadlineState(task.due, today);
  if (state.state === 'overdue') return { urgency: 'overdue' as const, days: state.days };
  const days = state.state === 'today' ? 0 : state.days;
  if (days <= SOON_DAYS) return { urgency: 'soon' as const, days };
  if (days <= WEEK_DAYS) return { urgency: 'week' as const, days };
  return { urgency: 'later' as const, days };
}

/**
 * Можно ли поставить срок на эту дату: не в прошлом и только рабочий день по календарю КР.
 * null — можно.
 */
export type DueProblem =
  | { code: 'past' }
  | { code: 'weekend' }
  | { code: 'holiday'; holiday: HolidayKey };

export function dueProblem(due: IsoDate, today: IsoDate = todayInBishkek()): DueProblem | null {
  if (diffDays(today, due) < 0) return { code: 'past' };
  const kind = dayKind(due);
  if (kind.kind === 'holiday') return { code: 'holiday', holiday: kind.holiday };
  if (kind.kind === 'weekend') return { code: 'weekend' };
  return null;
}
