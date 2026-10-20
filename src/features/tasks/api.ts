import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/errors';
import type { FeedbackMeta } from '@/shared/api/feedback';
import { addDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { createMockQueue, type Letter, type Suggestion } from './mailQueue';
import { atBishkek, createMockTasks, currentUserId, people } from './mock';
import {
  type HistoryKind,
  type Person,
  type Project,
  type Task,
  type TaskDetail,
  type TaskStatus,
  type TaskTab,
  WIP_LIMIT,
} from './types';

/**
 * Данные задач. Пока бэкенда нет — заглушка в памяти (mock.ts); когда появится API,
 * меняются только функции fetch*, хуки и интерфейс остаются.
 */
let store = createMockTasks();
let queue: Letter[] = createMockQueue();

/** Журнал действий (заглушка): только добавляется, записи не меняются и не удаляются */
export type JournalEntry = {
  at: string;
  author: string;
  action: 'mailRejected' | 'mailAccepted';
  details: string;
};
const journal: JournalEntry[] = [];
export const journalEntries = (): readonly JournalEntry[] => journal;

const delay = (ms: number) =>
  new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : ms));

/** Сброс заглушки (для тестов) */
export function resetTasksMock() {
  store = createMockTasks();
  queue = createMockQueue();
  journal.length = 0;
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
      // Копии, как от настоящего API: изменения в заглушке не должны менять уже выданные данные
      return structuredClone(tasksFor(tab));
    },
  });
}

/** Счётчики вкладок — из тех же данных, что и содержимое вкладок */
/** Счётчики вкладок — те же списки, что и содержимое вкладок */
export const tabCounts = (): Record<TaskTab, number> => ({
  mine: tasksFor('mine').length,
  department: tasksFor('department').length,
  createdByMe: tasksFor('createdByMe').length,
  completed: tasksFor('completed').length,
});

export function useTabCounts() {
  return useQuery({
    queryKey: [...tasksKey, 'counts'],
    queryFn: async (): Promise<Record<TaskTab, number>> => {
      await delay(60);
      return tabCounts();
    },
  });
}

/** Как ответит бэкенд: 409 с кодом wip_limit — текст ошибки возьмётся из errors.code.* */
export class WipLimitError extends ApiError {
  constructor() {
    super(409, 'wip-limit', { code: 'wip_limit' });
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

export const mailQueueKey = ['mailQueue'] as const;

/** Сколько писем разобрано (есть предложение) и сколько нужно оформить вручную */
export const queueSummary = () => ({
  ready: queue.filter((l) => l.suggestion).length,
  manual: queue.filter((l) => !l.suggestion).length,
});

export function useMailQueueSummary() {
  return useQuery({
    queryKey: [...mailQueueKey, 'summary'],
    queryFn: async () => queueSummary(),
  });
}

export function useMailQueue() {
  return useQuery({
    queryKey: [...mailQueueKey, 'list'],
    queryFn: async () => {
      await delay(80);
      return structuredClone(queue);
    },
  });
}

/** Создать задачу из предложения модели; письмо уходит из очереди */
export async function createFromLetter(letterId: string, suggestion: Suggestion) {
  const letter = queue.find((l) => l.id === letterId);
  if (!letter) throw new Error('not-found');
  if (!suggestion.assignee || !suggestion.due) throw new Error('incomplete');
  const task = await createTask({
    title: suggestion.title,
    description: letter.body,
    assignee: suggestion.assignee,
    due: suggestion.due,
    project: suggestion.project,
    priority: suggestion.priority,
    attachments: letter.attachments.length,
    letter,
  });
  queue = queue.filter((l) => l.id !== letterId);
  journal.unshift({
    at: now(),
    author: me().short,
    action: 'mailAccepted',
    details: `${letter.subject} → ${task.code}`,
  });
  return task;
}

/** Отклонить письмо с причиной — причина и автор попадают в журнал */
export async function rejectLetter(letterId: string, reason: string) {
  await delay(60);
  const letter = queue.find((l) => l.id === letterId);
  if (!letter) throw new Error('not-found');
  if (reason.trim().length < 5) throw new Error('reason-required');
  queue = queue.filter((l) => l.id !== letterId);
  journal.unshift({
    at: now(),
    author: me().short,
    action: 'mailRejected',
    details: `${letter.subject}: ${reason.trim()}`,
  });
}

/** Письмо оформили задачей вручную — убрать из очереди */
export function consumeLetter(letterId: string) {
  queue = queue.filter((l) => l.id !== letterId);
}

function useQueueMutation<V, R>(fn: (vars: V) => Promise<R>, meta?: FeedbackMeta) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta,
    onSettled: () => {
      client.invalidateQueries({ queryKey: mailQueueKey });
      client.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

export const useCreateFromLetter = () =>
  useQueueMutation(
    ({ letterId, suggestion }: { letterId: string; suggestion: Suggestion }) =>
      createFromLetter(letterId, suggestion),
    {
      successMessage: (task: TaskDetail) => ({
        key: 'mailQueue.created',
        params: { code: task.code },
      }),
    },
  );

export const useRejectLetter = () =>
  useQueueMutation(
    ({ letterId, reason }: { letterId: string; reason: string }) => rejectLetter(letterId, reason),
    { successMessage: 'mailQueue.rejected' },
  );

// ——— Карточка задачи ———

const allTasks = () => [...store.department, ...store.archive];

const me = (): Person => Object.values(people).find((p) => p.id === currentUserId) ?? people.ad;

const now = () => new Date().toISOString();

let seq = 0;
const id = (prefix: string) => `${prefix}-new-${++seq}`;

/** Журнал изменений только дополняется — записи не меняются и не удаляются */
function log(task: TaskDetail, kind: HistoryKind, text: string) {
  task.history.unshift({ id: id('h'), kind, text, at: now() });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: [...tasksKey, 'detail', taskId],
    enabled: taskId !== null,
    queryFn: async () => {
      await delay(80);
      const task = allTasks().find((t) => t.id === taskId);
      return task ? structuredClone(task) : null;
    },
  });
}

function useTaskMutation<V>(fn: (task: TaskDetail, vars: V) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, ...vars }: V & { taskId: string }) => {
      await delay(60);
      const task = allTasks().find((t) => t.id === taskId);
      if (!task) throw new Error('not-found');
      fn(task, vars as unknown as V);
    },
    onSettled: () => client.invalidateQueries({ queryKey: tasksKey }),
  });
}

export const useToggleSubtask = () =>
  useTaskMutation<{ subtaskId: string }>((task, { subtaskId }) => {
    const sub = task.subtaskItems.find((s) => s.id === subtaskId);
    if (!sub) return;
    sub.done = !sub.done;
    log(task, 'subtask', `${sub.done ? 'done' : 'undone'}|${sub.title}`);
  });

export const useAddSubtask = () =>
  useTaskMutation<{ title: string }>((task, { title }) => {
    task.subtaskItems.push({ id: id('s'), title, done: false, assignee: null });
    task.subtasks = task.subtaskItems.length;
    log(task, 'subtask', `added|${title}`);
  });

export const useAddComment = () =>
  useTaskMutation<{ text: string }>((task, { text }) => {
    task.commentItems.push({ id: id('c'), author: me(), at: now(), text });
    task.comments = task.commentItems.length;
  });

// ——— Новая задача ———

export type NewTaskInput = {
  title: string;
  description: string;
  assignee: Person;
  due: IsoDate;
  project: Project | null;
  priority: Task['priority'];
  attachments: number;
  /** Письмо из очереди, из которого создана задача */
  letter?: Letter;
};

/** Новая задача попадает в «Очередь»; в журнал — запись о создании */
export async function createTask(input: NewTaskInput): Promise<TaskDetail> {
  const { letter: _letter, ...rest } = input;
  await delay(120);
  const number = 400 + store.department.length + store.archive.length + seq + 1;
  const task: TaskDetail = {
    id: id('t'),
    code: `ЗД-2026-${String(number).padStart(4, '0')}`,
    status: 'queue',
    author: me(),
    subtasks: 0,
    comments: 0,
    fromEmail: input.letter !== undefined,
    reschedules: 0,
    escalationHours: null,
    deputy: null,
    knowledgeLink: null,
    subtaskItems: [],
    commentItems: [],
    history: [],
    rescheduleLog: [],
    reminderDays: null,
    escalatedAt: null,
    source: input.letter
      ? { kind: 'email', mailbox: 'info@olympic.kg', at: input.letter.receivedAt }
      : { kind: 'manual' },
    department: 'Административный',
    ...rest,
  };
  log(task, 'created', input.letter ? 'email' : 'manual');
  if (input.letter) consumeLetter(input.letter.id);
  store.department.unshift(task);
  return structuredClone(task);
}

export function useCreateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    meta: {
      successMessage: (task: TaskDetail) => ({
        key: 'newTask.created',
        params: { title: task.title },
      }),
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: tasksKey });
      client.invalidateQueries({ queryKey: mailQueueKey });
    },
  });
}

const stem = (word: string) => word.toLocaleLowerCase('ru').slice(0, 6);
const words = (text: string) =>
  new Set(
    text
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 || /\d{4}/.test(w))
      .map(stem),
  );

/** Похожие активные задачи по совпадению слов в названии — не блокируют создание */
export function findSimilar(title: string, limit = 2): Task[] {
  const target = words(title);
  if (target.size < 2) return [];
  return store.department
    .filter((t) => t.status !== 'done')
    .map((t) => {
      const common = [...words(t.title)].filter((w) => target.has(w)).length;
      return { t, common };
    })
    .filter(({ common }) => common >= 2)
    .sort((a, b) => b.common - a.common)
    .slice(0, limit)
    .map(({ t }) => t);
}

/** Ближайший рабочий день не раньше завтрашнего — срок по умолчанию */
export const defaultDue = () => addDays(todayInBishkek(), 2);
export { atBishkek };
