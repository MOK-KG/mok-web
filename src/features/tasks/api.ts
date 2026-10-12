import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMockTasks, currentUserId } from './mock';
import { type Task, type TaskStatus, type TaskTab, WIP_LIMIT } from './types';

/**
 * Данные задач. Пока бэкенда нет — заглушка в памяти (mock.ts); когда появится API,
 * меняются только функции fetch*, хуки и интерфейс остаются.
 */
let store = createMockTasks();

const delay = (ms: number) =>
  new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : ms));

/** Сброс заглушки (для тестов) */
export function resetTasksMock() {
  store = createMockTasks();
}

function tasksFor(tab: TaskTab): Task[] {
  switch (tab) {
    case 'mine':
      return store.department.filter((t) => t.assignee?.id === currentUserId);
    case 'department':
      return store.department;
    case 'createdByMe':
      return store.department.filter((t) => t.author.id === currentUserId);
    case 'completed':
      return store.archive;
  }
}

export const tasksKey = ['tasks'] as const;

export function useTasks(tab: TaskTab) {
  return useQuery({
    queryKey: [...tasksKey, tab],
    queryFn: async () => {
      await delay(120);
      return tasksFor(tab);
    },
  });
}

/** Счётчики вкладок — из тех же данных, что и содержимое вкладок */
export function useTabCounts() {
  return useQuery({
    queryKey: [...tasksKey, 'counts'],
    queryFn: async (): Promise<Record<TaskTab, number>> => {
      await delay(60);
      return {
        mine: tasksFor('mine').length,
        department: tasksFor('department').length,
        createdByMe: tasksFor('createdByMe').length,
        completed: tasksFor('completed').length,
      };
    },
  });
}

export class WipLimitError extends Error {
  constructor() {
    super('wip-limit');
  }
}

/** Перенос задачи в другую колонку; «В работе» — не больше WIP_LIMIT задач */
export async function moveTask(id: string, status: TaskStatus) {
  await delay(80);
  const task = store.department.find((t) => t.id === id);
  if (!task || task.status === status) return;
  const inProgress = store.department.filter((t) => t.status === 'in_progress').length;
  if (status === 'in_progress' && inProgress >= WIP_LIMIT) throw new WipLimitError();
  task.status = status;
}

export function useMoveTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => moveTask(id, status),
    onSettled: () => client.invalidateQueries({ queryKey: tasksKey }),
  });
}

/** ЗАГЛУШКА очереди из почты: сколько писем готовы к созданию и сколько разобрать вручную */
export function useMailQueueSummary() {
  return useQuery({
    queryKey: ['mailQueue', 'summary'],
    queryFn: async () => ({ ready: 3, manual: 1 }),
  });
}
