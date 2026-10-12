import { addDays, diffDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { urgencyOf } from './deadline';
import type { Task } from './types';

export type DueFilter = 'overdue' | 'week' | 'none';

export const dueFilters: DueFilter[] = ['overdue', 'week', 'none'];

export type TaskFilters = {
  projects: string[];
  due: DueFilter[];
};

export const emptyFilters: TaskFilters = { projects: [], due: [] };

export const hasFilters = (f: TaskFilters) => f.projects.length > 0 || f.due.length > 0;

/** Последний день текущей календарной недели (воскресенье) */
function endOfWeek(today: IsoDate): IsoDate {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 — воскресенье
  return addDays(today, weekday === 0 ? 0 : 7 - weekday);
}

export function matchesDue(task: Task, due: DueFilter, today: IsoDate = todayInBishkek()) {
  const { urgency } = urgencyOf(task, today);
  switch (due) {
    case 'overdue':
      return urgency === 'overdue';
    case 'none':
      return task.due === null;
    case 'week':
      return (
        task.due !== null &&
        task.status !== 'done' &&
        diffDays(today, task.due) >= 0 &&
        diffDays(task.due, endOfWeek(today)) >= 0
      );
  }
}

/** Проекты — «ИЛИ» внутри группы, сроки — «ИЛИ» внутри группы, группы — «И» */
export function applyFilters(
  tasks: Task[],
  filters: TaskFilters,
  search: string,
  today: IsoDate = todayInBishkek(),
) {
  const query = search.trim().toLocaleLowerCase('ru');
  return tasks.filter(
    (t) =>
      (filters.projects.length === 0 || filters.projects.includes(t.project.id)) &&
      (filters.due.length === 0 || filters.due.some((d) => matchesDue(t, d, today))) &&
      (query === '' || t.title.toLocaleLowerCase('ru').includes(query)),
  );
}
