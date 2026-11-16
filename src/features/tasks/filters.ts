import { addDays, diffDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { urgencyOf } from './deadline';
import type { Task } from './types';

export type DueFilter = 'overdue' | 'soon' | 'week' | 'none';

export const dueFilters: DueFilter[] = ['overdue', 'soon', 'week', 'none'];

export const isDueFilter = (value: string): value is DueFilter =>
  (dueFilters as string[]).includes(value);

export type TaskFilters = {
  projects: string[];
  departments: string[];
  due: DueFilter[];
};

export const emptyFilters: TaskFilters = { projects: [], departments: [], due: [] };

export const hasFilters = (f: TaskFilters) =>
  f.projects.length > 0 || f.departments.length > 0 || f.due.length > 0;

export const departmentOf = (task: Task): string | null => task.assignee?.unit || null;

export function departmentsOf(tasks: Task[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const name = departmentOf(t);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

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
    case 'soon':
      return urgency === 'soon';
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
      (filters.projects.length === 0 ||
        (t.project !== null && filters.projects.includes(t.project.id))) &&
      (filters.departments.length === 0 || filters.departments.includes(departmentOf(t) ?? '')) &&
      (filters.due.length === 0 || filters.due.some((d) => matchesDue(t, d, today))) &&
      (query === '' || t.title.toLocaleLowerCase('ru').includes(query)),
  );
}
