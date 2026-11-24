import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCan } from '@/features/auth/permissions';
import { resetJournal } from '@/features/journal/store';
import { ApiError, api } from '@/shared/api/client';
import type { FeedbackMeta } from '@/shared/api/feedback';
import { type Tone, toneNames } from '@/shared/config/tokens';
import { addDays, type IsoDate, nextWorkingDay, todayInBishkek } from '@/shared/lib/workDays';
import type { Letter, Suggestion } from './mailQueue';
import type {
  Column,
  HistoryEntry,
  Person,
  Project,
  Task,
  TaskDetail,
  TaskStatus,
  TaskTab,
} from './types';

/**
 * Данные задач — API бэкенда (mok-backend, apps/tasks, /api/tasks/*). Колонки доски
 * настраиваются на бэкенде; у каждой есть этап (TaskStatus) — по нему работают цвета и правила.
 * Права проверяет бэкенд: без права — 403, лимит колонки — 409 wip_limit.
 *
 * В тестах вместо бэкенда — подставной сервер testing/server.ts на данных mock.ts.
 */

// Журнал действий — общий модуль features/journal/store.ts (цепочка хешей)
export { addJournalEntry, type JournalEntry, journalEntries } from '@/features/journal/store';

// --- Формат бэкенда ---------------------------------------------------------------------------

export type ApiPerson = {
  id: string;
  email: string;
  name: string;
  position?: string;
  department?: string;
};

type ApiProject = { id: string; name: string; tone: Tone; archived?: boolean };

export type ApiTask = Omit<Task, 'assignee' | 'author' | 'deputy' | 'project' | 'id'> & {
  id: string;
  assignee: ApiPerson | null;
  author: ApiPerson | null;
  deputy: ApiPerson | null;
  project: ApiProject | null;
  position: number;
  subtasksDone?: number;
  archived?: boolean;
};

type ApiAttachment = { id: string; filename: string; size: number; mimeType?: string };

export type ApiTaskDetail = ApiTask & {
  description: string;
  knowledgeLink: { id: string; title: string } | null;
  subtaskItems: { id: string; title: string; done: boolean; assignee: ApiPerson | null }[];
  commentItems: { id: string; author: ApiPerson | null; at: string; text: string }[];
  attachmentItems: ApiAttachment[];
  history: { id: string; kind: HistoryEntry['kind']; text: string; at: string }[];
  rescheduleLog: { from: IsoDate; to: IsoDate; by: ApiPerson | null }[];
  letters?: TaskDetail['letters'];
  reminderDays: number | null;
  escalatedAt: string | null;
  source:
    | { kind: 'email'; mailbox: string; at: string; letterId?: string }
    | {
        kind: 'document';
        documentId: string;
        documentKind: string;
        number: string | null;
        title: string;
        party: string;
        resolution: string;
        author: ApiPerson;
        at: string;
      }
    | { kind: 'manual' };
  department: string;
};

type ApiSuggestion = Omit<Suggestion, 'assignee' | 'project'> & {
  assignee: ApiPerson | null;
  project: ApiProject | null;
};

export type ApiLetter = Omit<Letter, 'attachments' | 'suggestion'> & {
  attachments: ApiAttachment[];
  suggestion: ApiSuggestion | null;
};

export type Board = {
  columns: Column[];
  tasks: Task[];
  counts: Record<TaskTab, number>;
};

export type Directory = { people: Person[]; projects: Project[]; columns: Column[] };

// --- Преобразования ---------------------------------------------------------------------------

/** Цвет аватара — по ID сотрудника, одинаковый на всех экранах */
const toneOf = (id: string): Tone => {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return toneNames[hash % toneNames.length];
};

/** «Нурлан Бакиров» → «Н. Бакиров» */
const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
};

const nobody: Person = { id: 'system', name: '—', short: '—', tone: 'blue' };

export function toPerson(p: ApiPerson | null): Person {
  if (!p) return nobody;
  return {
    id: String(p.id),
    name: p.name,
    short: shortName(p.name),
    tone: toneOf(String(p.id)),
    ...(p.department ? { unit: p.department } : {}),
  };
}

const maybePerson = (p: ApiPerson | null) => (p ? toPerson(p) : null);

const toProject = (p: ApiProject | null): Project | null =>
  p ? { id: p.id, name: p.name, tone: p.tone } : null;

/**
 * Заместитель считает бэкенд — по действующему отсутствию исполнителя на сегодня (у готовой
 * задачи его нет): оформили отпуск — задача сразу у заместителя, отпуск кончился — права
 * заместителя прекратились сами (приёмка 11.11)
 */
export function toTask(t: ApiTask): Task {
  return {
    id: t.id,
    code: t.code,
    title: t.title,
    status: t.status,
    columnId: t.columnId,
    position: t.position,
    project: toProject(t.project),
    due: t.due,
    assignee: maybePerson(t.assignee),
    author: toPerson(t.author),
    priority: t.priority,
    subtasks: t.subtasks,
    comments: t.comments,
    attachments: t.attachments,
    fromEmail: t.fromEmail,
    reschedules: t.reschedules,
    escalationHours: t.escalationHours,
    deputy: maybePerson(t.deputy),
  };
}

export function toTaskDetail(t: ApiTaskDetail): TaskDetail {
  return {
    ...toTask(t),
    description: t.description,
    knowledgeLink: t.knowledgeLink?.title ?? null,
    knowledgeArticleId: t.knowledgeLink?.id ?? null,
    attachmentItems: t.attachmentItems.map(({ id, filename, size }) => ({ id, filename, size })),
    subtaskItems: t.subtaskItems.map((s) => ({ ...s, assignee: maybePerson(s.assignee) })),
    commentItems: t.commentItems.map((c) => ({ ...c, author: toPerson(c.author) })),
    history: t.history.map(({ id, kind, text, at }) => ({ id, kind, text, at })),
    rescheduleLog: t.rescheduleLog.map((r) => ({ from: r.from, to: r.to, by: toPerson(r.by) })),
    letters: t.letters ?? [],
    reminderDays: t.reminderDays,
    escalatedAt: t.escalatedAt,
    archived: t.archived ?? false,
    source: toSource(t.source),
    department: t.department,
  };
}

function toSource(s: ApiTaskDetail['source']): TaskDetail['source'] {
  if (s.kind === 'email') return { kind: 'email', mailbox: s.mailbox, at: s.at };
  if (s.kind === 'document') {
    const { kind, documentId, documentKind, number, title, party, resolution, at } = s;
    return {
      kind,
      documentId,
      documentKind,
      number,
      title,
      party,
      resolution,
      at,
      author: toPerson(s.author),
    };
  }
  return { kind: 'manual' };
}

export function toLetter(l: ApiLetter): Letter {
  return {
    id: l.id,
    sender: l.sender,
    address: l.address,
    organization: l.organization,
    subject: l.subject,
    receivedAt: l.receivedAt,
    body: l.body,
    attachments: l.attachments.map((a) => a.filename),
    suggestion: l.suggestion && {
      ...l.suggestion,
      assignee: maybePerson(l.suggestion.assignee),
      project: toProject(l.suggestion.project),
    },
  };
}

// --- Доска ------------------------------------------------------------------------------------

export const tasksKey = ['tasks'] as const;

/** Доска вкладки: колонки, задачи и счётчики всех вкладок */
export async function fetchBoard(tab: TaskTab = 'department'): Promise<Board> {
  const board = await api.get<Omit<Board, 'tasks'> & { tasks: ApiTask[] }>('/tasks/board', {
    query: { tab },
  });
  return { ...board, tasks: board.tasks.map(toTask) };
}

export function useBoard(tab: TaskTab) {
  const { can } = useCan();
  return useQuery({
    enabled: can('tasks.view'),
    queryKey: [...tasksKey, 'board', tab],
    queryFn: () => fetchBoard(tab),
    placeholderData: keepPreviousData,
  });
}

/** Задачи вкладки (для доски и других разделов: календарь, дашборд, поиск) */
export function useTasks(tab: TaskTab) {
  const board = useBoard(tab);
  return { ...board, data: board.data?.tasks };
}

/** Счётчики вкладок — те же списки, что и содержимое вкладок */
export function useTabCounts() {
  const board = useBoard('department');
  return { ...board, data: board.data?.counts };
}

export function useDirectory() {
  const { can } = useCan();
  return useQuery({
    enabled: can('tasks.view'),
    queryKey: [...tasksKey, 'directory'],
    queryFn: async (): Promise<Directory> => {
      const d = await api.get<{ people: ApiPerson[]; projects: ApiProject[]; columns: Column[] }>(
        '/tasks/directory',
      );
      return {
        people: d.people.map(toPerson),
        projects: d.projects.map((p) => toProject(p) as Project),
        columns: d.columns,
      };
    },
    staleTime: 60_000,
  });
}

export type ManagedProject = Project & { archived: boolean };

export function useProjects() {
  return useQuery({
    queryKey: [...tasksKey, 'projects'],
    queryFn: async (): Promise<ManagedProject[]> =>
      (await api.get<ApiProject[]>('/tasks/projects')).map((p) => ({
        id: p.id,
        name: p.name,
        tone: p.tone,
        archived: Boolean(p.archived),
      })),
  });
}

function useProjectMutation<V, R>(fn: (vars: V) => Promise<R>, meta?: FeedbackMeta) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta,
    onSuccess: () => client.invalidateQueries({ queryKey: tasksKey }),
  });
}

export const useCreateProject = () =>
  useProjectMutation(
    (project: { name: string; tone: Tone }) => api.post<ApiProject>('/tasks/projects', project),
    { successMessage: 'projects.created', errorMessage: false },
  );

export const useUpdateProject = () =>
  useProjectMutation(
    ({ id, ...changes }: { id: string; name?: string; tone?: Tone; archived?: boolean }) =>
      api.patch<ApiProject>(`/tasks/projects/${id}`, changes),
  );

/** 409 wip_limit — текст ошибки возьмётся из errors.code.* */
export class WipLimitError extends ApiError {
  constructor(limit?: number) {
    super(409, 'wip-limit', { code: 'wip_limit' });
    this.limit = limit;
  }

  readonly limit?: number;
}

/** Перенос задачи в колонку (и на место в ней); лимит колонки — 409 wip_limit */
export async function moveTask(id: string, columnId: string, beforeId?: string | null) {
  try {
    await api.post(`/tasks/items/${id}/move`, { columnId, beforeId: beforeId ?? null });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'wip_limit') throw new WipLimitError();
    throw error;
  }
}

type MoveVars = { id: string; columnId: string; beforeId?: string | null };

/**
 * Задачи доски после переноса: задача встаёт в колонку перед beforeId (или в конец),
 * позиции колонки пересчитываются. Так доска показывает перенос сразу, не дожидаясь ответа.
 */
export function applyMove(board: Board, { id, columnId, beforeId }: MoveVars): Board {
  const moving = board.tasks.find((t) => t.id === id);
  const column = board.columns.find((c) => c.id === columnId);
  if (!moving || !column) return board;
  const siblings = board.tasks
    .filter((t) => t.columnId === columnId && t.id !== id)
    .sort((a, b) => a.position - b.position);
  const at = beforeId ? siblings.findIndex((t) => t.id === beforeId) : -1;
  siblings.splice(at < 0 ? siblings.length : at, 0, {
    ...moving,
    columnId,
    status: column.stage,
  });
  const placed = new Map(siblings.map((t, i) => [t.id, { ...t, position: i }]));
  return { ...board, tasks: board.tasks.map((t) => placed.get(t.id) ?? t) };
}

export function useMoveTask() {
  const client = useQueryClient();
  const boards = { queryKey: [...tasksKey, 'board'] };
  const mutation = useMutation({
    mutationFn: ({ id, columnId, beforeId }: MoveVars) => moveTask(id, columnId, beforeId),
    onMutate: () => client.cancelQueries(boards, { revert: false }),
    meta: { errorMessage: false },
    onSettled: () => client.invalidateQueries({ queryKey: tasksKey }),
  });
  const mutate: typeof mutation.mutate = (vars, options) => {
    const previous = client.getQueriesData<Board>(boards);
    client.setQueriesData<Board>(boards, (board) => (board ? applyMove(board, vars) : board));
    mutation.mutate(vars, {
      ...options,
      onError: (...args) => {
        for (const [key, data] of previous) client.setQueryData(key, data);
        options?.onError?.(...args);
      },
    });
  };
  return { ...mutation, mutate };
}

// --- Очередь из почты -------------------------------------------------------------------------

export const mailQueueKey = ['mailQueue'] as const;

export function useMailQueueSummary() {
  const { can } = useCan();
  return useQuery({
    enabled: can('tasks.create'),
    queryKey: [...mailQueueKey, 'summary'],
    queryFn: () => api.get<{ ready: number; manual: number }>('/tasks/mail/summary'),
  });
}

export function useMailQueue() {
  const { can } = useCan();
  return useQuery({
    enabled: can('tasks.create'),
    queryKey: [...mailQueueKey, 'list'],
    queryFn: async () => (await api.get<ApiLetter[]>('/tasks/mail/letters')).map(toLetter),
  });
}

/**
 * Создать задачу из предложения агента (поля — как их поправил человек); письмо уходит из очереди.
 * Запись «Задача из письма» в журнал действий делает бэкенд.
 */
export async function createFromLetter(letter: Letter, suggestion: Suggestion) {
  return toTaskDetail(
    await api.post<ApiTaskDetail>(`/tasks/mail/letters/${letter.id}/accept`, {
      title: suggestion.title,
      assigneeId: suggestion.assignee?.id ?? null,
      due: suggestion.due,
      projectId: suggestion.project?.id ?? null,
      priority: suggestion.priority,
    }),
  );
}

/** Отклонить письмо с причиной — причину и автора бэкенд записывает в журнал действий */
export async function rejectLetter(letter: Letter, reason: string) {
  await api.post(`/tasks/mail/letters/${letter.id}/reject`, { reason: reason.trim() });
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
    ({ letter, suggestion }: { letter: Letter; suggestion: Suggestion }) =>
      createFromLetter(letter, suggestion),
    {
      successMessage: (task: TaskDetail) => ({
        key: 'mailQueue.created',
        params: { code: task.code },
      }),
    },
  );

export const useRejectLetter = () =>
  useQueueMutation(
    ({ letter, reason }: { letter: Letter; reason: string }) => rejectLetter(letter, reason),
    { successMessage: 'mailQueue.rejected' },
  );

// --- Карточка задачи --------------------------------------------------------------------------

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: [...tasksKey, 'detail', taskId],
    enabled: taskId !== null,
    queryFn: async () => {
      try {
        return toTaskDetail(await api.get<ApiTaskDetail>(`/tasks/items/${taskId}`));
      } catch (error) {
        // Нет такой задачи — карточка покажет «не найдена»
        if (error instanceof ApiError && (error.status === 404 || error.status === 400))
          return null;
        throw error;
      }
    },
  });
}

function useTaskMutation<V>(fn: (taskId: string, vars: V) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...vars }: V & { taskId: string }) => fn(taskId, vars as unknown as V),
    onSettled: () => client.invalidateQueries({ queryKey: tasksKey }),
  });
}

export const useToggleSubtask = () =>
  useTaskMutation<{ subtaskId: string; done: boolean }>((taskId, { subtaskId, done }) =>
    api.patch(`/tasks/items/${taskId}/subtasks/${subtaskId}`, { done }),
  );

export const useAddSubtask = () =>
  useTaskMutation<{ title: string }>((taskId, { title }) =>
    api.post(`/tasks/items/${taskId}/subtasks`, { title }),
  );

export const useAddComment = () =>
  useTaskMutation<{ text: string }>((taskId, { text }) =>
    api.post(`/tasks/items/${taskId}/comments`, { text }),
  );

/** Скачать вложение задачи */
export const attachmentUrl = (id: string) => api.url(`/tasks/attachments/${id}/download`);

// --- Новая задача -----------------------------------------------------------------------------

export type NewTaskInput = {
  title: string;
  description: string;
  assignee: Person;
  due: IsoDate;
  project: Project | null;
  priority: Task['priority'];
  /** Файлы — загружаются после создания задачи */
  files?: File[];
  /** Письмо из очереди, которое оформляют задачей вручную */
  letter?: Letter;
  /** Пользователь видел предупреждение о похожих задачах и всё равно создаёт */
  confirmDuplicate?: boolean;
  /** За сколько календарных дней до срока напомнить; null — не напоминать */
  reminderDays?: number | null;
};

/** Новая задача попадает в первую колонку этапа «Очередь»; файлы загружаются следом */
export async function createTask(input: NewTaskInput): Promise<TaskDetail> {
  const created = await api.post<ApiTaskDetail>('/tasks/items', {
    title: input.title,
    description: input.description,
    assigneeId: input.assignee.id,
    due: input.due,
    projectId: input.project?.id ?? null,
    priority: input.priority,
    letterId: input.letter?.id ?? null,
    confirmDuplicate: input.confirmDuplicate ?? false,
    reminderDays: input.reminderDays ?? null,
  });
  for (const file of input.files ?? []) {
    const form = new FormData();
    form.append('file', file);
    await api.post(`/tasks/items/${created.id}/attachments`, form);
  }
  const task = toTaskDetail(created);
  return input.files?.length
    ? { ...task, attachments: task.attachments + input.files.length }
    : task;
}

export type TaskChanges = Omit<NewTaskInput, 'letter' | 'assignee' | 'due'> & {
  due: IsoDate | null;
  /** null — исполнителя не меняли (смена исполнителя требует tasks.assign) */
  assignee: Person | null;
};

/** Правка задачи: поля — PATCH, новые файлы — следом. Смена срока и исполнителя — в журнал задачи */
export async function updateTask(id: string, changes: TaskChanges): Promise<TaskDetail> {
  const updated = await api.patch<ApiTaskDetail>(`/tasks/items/${id}`, {
    title: changes.title,
    description: changes.description,
    due: changes.due,
    projectId: changes.project?.id ?? null,
    priority: changes.priority,
    ...(changes.reminderDays !== undefined ? { reminderDays: changes.reminderDays } : {}),
    ...(changes.assignee ? { assigneeId: changes.assignee.id } : {}),
  });
  for (const file of changes.files ?? []) {
    const form = new FormData();
    form.append('file', file);
    await api.post(`/tasks/items/${id}/attachments`, form);
  }
  return toTaskDetail(updated);
}

export function useUpdateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...changes }: TaskChanges & { id: string }) => updateTask(id, changes),
    meta: { successMessage: 'newTask.saved' },
    onSettled: () => client.invalidateQueries({ queryKey: tasksKey }),
  });
}

/** В архив и обратно (право tasks.archive). Задачи не удаляются */
export function useArchiveTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.post<{ archived: boolean }>(`/tasks/items/${id}/archive`, { archived }),
    meta: {
      successMessage: (task: { archived: boolean }) =>
        task.archived ? 'taskCard.archivedToast' : 'taskCard.restoredToast',
    },
    onSettled: () => client.invalidateQueries({ queryKey: tasksKey }),
  });
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

/** Похожие незакрытые задачи по словам названия — предупреждают, но не блокируют создание */
export function useSimilarTasks(title: string) {
  const query = title.trim();
  return useQuery({
    queryKey: [...tasksKey, 'similar', query],
    enabled: query.length >= 6,
    queryFn: async () =>
      (await api.get<ApiTask[]>('/tasks/similar', { query: { title: query } })).map(toTask),
    placeholderData: keepPreviousData,
  });
}

/** Ближайший рабочий день не раньше завтрашнего — срок по умолчанию */
export const defaultDue = () => nextWorkingDay(addDays(todayInBishkek(), 2));

/** Сброс состояния между тестами: журнал действий */
export function resetTasksMock() {
  resetJournal();
}

export type { TaskStatus };
