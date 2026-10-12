import { type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { urgencyOf } from './deadline';
import { currentUserId } from './mock';
import type { Task } from './types';

/** Быстрые фильтры мобильного списка (макет Figma: «Все / Просрочено / Мои / Горит») */
export type QuickFilter = 'all' | 'overdue' | 'mine' | 'hot';

export const quickFilters: QuickFilter[] = ['all', 'overdue', 'mine', 'hot'];

/** «Горит» — срок в ближайшие 2 дня или эскалация */
export function matchesQuick(task: Task, filter: QuickFilter, today: IsoDate = todayInBishkek()) {
  const { urgency } = urgencyOf(task, today);
  switch (filter) {
    case 'all':
      return true;
    case 'overdue':
      return urgency === 'overdue';
    case 'mine':
      return task.assignee?.id === currentUserId;
    case 'hot':
      return task.status !== 'done' && (urgency === 'soon' || task.escalationHours !== null);
  }
}

/**
 * Порядок списка: сначала то, что требует внимания — просрочено, эскалация, «горит»,
 * срок на неделе, исполнитель в отпуске; дальше по сроку; готовые — в конце.
 */
export function sortForList(tasks: Task[], today: IsoDate = todayInBishkek()) {
  const rank = (t: Task) => {
    if (t.status === 'done') return 7;
    const { urgency } = urgencyOf(t, today);
    if (urgency === 'overdue') return 0;
    if (t.escalationHours !== null) return 1;
    if (urgency === 'soon') return 2;
    if (urgency === 'week') return 3;
    if (t.deputy) return 4;
    return urgency === 'none' ? 6 : 5;
  };
  const due = (t: Task) => t.due ?? '9999-12-31';
  return [...tasks].sort((a, b) => rank(a) - rank(b) || due(a).localeCompare(due(b)));
}
