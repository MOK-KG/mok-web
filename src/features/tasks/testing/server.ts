import { vi } from 'vitest';
import { absencesServer } from '@/features/absences/testing/server';
import { journalServer } from '@/features/journal/testing/server';
import type { IsoDate } from '@/shared/lib/workDays';
import { todayInBishkek } from '@/shared/lib/workDays';
import type { ApiLetter, ApiPerson, ApiTask, ApiTaskDetail } from '../api';
import { currentUserId, people, projects } from '../directory';
import { createMockQueue, type Letter } from '../mailQueue';
import { createMockTasks, mockColumns } from '../mock';
import type { Column, Person, Project, TaskDetail, TaskTab } from '../types';

/**
 * Подставной бэкенд задач для тестов: те же адреса и формат ответов, что у mok-backend
 * (apps/tasks/views.py), данные — из mock.ts и mailQueue.ts. Подменяет fetch только для
 * /api/tasks/* и /api/auth/csrf; остальные запросы уходят дальше (например, в подставной
 * сервер базы знаний). Ставится перед каждым тестом в src/test/setup.ts.
 *
 * Текущий сотрудник — Айбек Дуйшеев (currentUserId), как в заглушке.
 */

type Reply = { status: number; body?: unknown };
type Body = Record<string, unknown>;

const apiPerson = (p: Person | null): ApiPerson | null =>
  p && {
    id: p.id,
    email: `${p.id}@olympic.kg`,
    name: p.name,
    position: '',
    department: p.unit ?? '',
  };

const allPeople = Object.values(people) as Person[];
const allProjects = Object.values(projects) as Project[];

const error = (status: number, code: string, extra: Body = {}): Reply => ({
  status,
  body: { code, detail: code, ...extra },
});

/** Как similar_tasks на бэкенде: слова от 4 букв (или с годом), первые 6 букв, совпало ≥ 2 */
const stems = (text: string) =>
  new Set(
    text
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 || /\d{4}/.test(w))
      .map((w) => w.toLocaleLowerCase('ru').slice(0, 6)),
  );

export function createTasksServer({ today = todayInBishkek() }: { today?: IsoDate } = {}) {
  const { department, archive } = createMockTasks(today);
  const tasks: (TaskDetail & { archived: boolean })[] = [
    ...department.map((t) => ({ ...t, archived: false })),
    ...archive.map((t) => ({ ...t, archived: true })),
  ];
  const columns: Column[] = mockColumns();
  let letters: Letter[] = createMockQueue(today);
  const projectList: (Project & { archived: boolean })[] = allProjects.map((p) => ({
    ...p,
    archived: false,
  }));
  let seq = 0;
  const me = allPeople.find((p) => p.id === currentUserId) as Person;

  const columnOf = (id: string) => columns.find((c) => c.id === id);
  const countIn = (columnId: string) =>
    tasks.filter((t) => !t.archived && t.columnId === columnId).length;
  const withCounts = () => columns.map((c) => ({ ...c, count: countIn(c.id) }));

  const tab = (name: TaskTab) => {
    if (name === 'completed') return tasks.filter((t) => t.archived);
    const active = tasks.filter((t) => !t.archived);
    if (name === 'mine') return active.filter((t) => t.assignee?.id === me.id);
    if (name === 'createdByMe') return active.filter((t) => t.author.id === me.id);
    return active;
  };

  const summary = (t: TaskDetail & { archived: boolean }): ApiTask => ({
    id: t.id,
    code: t.code,
    title: t.title,
    status: t.status,
    columnId: t.columnId,
    position: t.position,
    project: t.project,
    due: t.due,
    assignee: apiPerson(t.assignee),
    author: apiPerson(t.author),
    priority: t.priority,
    subtasks: t.subtaskItems.length,
    subtasksDone: t.subtaskItems.filter((s) => s.done).length,
    comments: t.commentItems.length,
    attachments: t.attachmentItems.length,
    fromEmail: t.fromEmail,
    reschedules: t.rescheduleLog.length,
    escalationHours: t.escalationHours,
    // Как на бэкенде: заместитель по действующему отсутствию исполнителя на сегодня
    deputy:
      t.status === 'done' ? null : apiPerson(absencesServer?.deputyOn(t.assignee?.id) ?? null),
    archived: t.archived,
  });

  const detail = (t: TaskDetail & { archived: boolean }): ApiTaskDetail => ({
    ...summary(t),
    description: t.description,
    knowledgeLink: t.knowledgeLink
      ? { id: t.knowledgeArticleId ?? 'article', title: t.knowledgeLink }
      : null,
    subtaskItems: t.subtaskItems.map((s) => ({ ...s, assignee: apiPerson(s.assignee) })),
    commentItems: t.commentItems.map((c) => ({ ...c, author: apiPerson(c.author) })),
    attachmentItems: t.attachmentItems,
    history: t.history,
    rescheduleLog: t.rescheduleLog.map((r) => ({ ...r, by: apiPerson(r.by) })),
    reminderDays: t.reminderDays,
    escalatedAt: t.escalatedAt,
    source:
      t.source.kind === 'document'
        ? { ...t.source, author: apiPerson(t.source.author) as ApiPerson }
        : t.source,
    department: t.department,
  });

  const letter = (l: Letter): ApiLetter => ({
    ...l,
    attachments: l.attachments.map((filename, i) => ({ id: `${l.id}-a${i}`, filename, size: 1 })),
    suggestion: l.suggestion && {
      ...l.suggestion,
      assignee: apiPerson(l.suggestion.assignee),
      project: l.suggestion.project,
    },
  });

  const now = () => new Date().toISOString();
  const log = (t: TaskDetail, kind: TaskDetail['history'][number]['kind'], text: string) =>
    t.history.unshift({ id: `h-new-${++seq}`, kind, text, at: now() });

  function createTask(b: Body, from?: Letter): Reply {
    const title = String(b.title ?? '').trim();
    if (title.length < 3) return error(400, 'title_short', { fields: { title: 'short' } });
    const assignee = allPeople.find((p) => p.id === b.assigneeId) ?? null;
    const queue = columns.find((c) => c.stage === 'queue') as Column;
    const number = 400 + tasks.length + 1;
    const task: TaskDetail & { archived: boolean } = {
      id: `t-new-${++seq}`,
      code: `ЗД-2026-${String(number).padStart(4, '0')}`,
      title,
      status: 'queue',
      columnId: queue.id,
      position:
        Math.max(0, ...tasks.filter((t) => t.columnId === queue.id).map((t) => t.position)) + 1,
      project: projectList.find((p) => p.id === b.projectId) ?? null,
      due: (b.due as IsoDate) ?? null,
      assignee,
      author: me,
      priority: (b.priority as TaskDetail['priority']) ?? 'normal',
      subtasks: 0,
      comments: 0,
      attachments: from ? from.attachments.length : 0,
      attachmentItems: (from?.attachments ?? []).map((filename, i) => ({
        id: `att-${seq}-${i}`,
        filename,
        size: 1,
      })),
      fromEmail: from !== undefined,
      reschedules: 0,
      escalationHours: null,
      deputy: null,
      description: String(b.description ?? from?.body ?? ''),
      knowledgeLink: null,
      knowledgeArticleId: null,
      subtaskItems: [],
      commentItems: [],
      history: [],
      rescheduleLog: [],
      reminderDays: null,
      escalatedAt: null,
      source: from
        ? { kind: 'email', mailbox: 'info@olympic.kg', at: from.receivedAt }
        : { kind: 'manual' },
      department: 'Административный',
      archived: false,
    };
    log(task, 'created', from ? 'email' : 'manual');
    tasks.unshift(task);
    if (from) {
      letters = letters.filter((l) => l.id !== from.id);
      // Как на бэкенде: задачу из письма пишет в журнал действий сервер
      journalServer?.record('mailAccepted', `${from.subject} → ${task.code}`);
    }
    return { status: 201, body: detail(task) };
  }

  function handle(method: string, path: string, query: URLSearchParams, body: unknown): Reply {
    const b = (body ?? {}) as Body;
    if (path === '/auth/csrf') return { status: 200, body: { csrfToken: 'test' } };
    const [, , resource, id, action, subId] = path.split('/');

    if (resource === 'board' && method === 'GET') {
      const name = (query.get('tab') ?? 'department') as TaskTab;
      return {
        status: 200,
        body: {
          columns: withCounts(),
          tasks: tab(name).map(summary),
          counts: {
            mine: tab('mine').length,
            department: tab('department').length,
            createdByMe: tab('createdByMe').length,
            completed: tab('completed').length,
          },
        },
      };
    }
    if (resource === 'directory' && method === 'GET') {
      return {
        status: 200,
        body: {
          people: allPeople.map(apiPerson),
          projects: projectList.filter((p) => !p.archived),
          columns: withCounts(),
        },
      };
    }
    if (resource === 'projects') {
      const clean = (v: unknown) =>
        String(v ?? '')
          .trim()
          .replace(/\s+/g, ' ');
      const taken = (name: string, except?: string) =>
        projectList.some(
          (p) => p.id !== except && p.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'),
        );
      if (!id && method === 'GET') return { status: 200, body: projectList };
      if (!id && method === 'POST') {
        const name = clean(b.name);
        if (!name) return error(400, 'invalid', { fields: { name: ['Укажите название.'] } });
        if (taken(name)) return error(409, 'project_exists');
        const project = {
          id: `p-new-${++seq}`,
          name,
          tone: (b.tone as Project['tone']) ?? 'blue',
          archived: false,
        };
        projectList.push(project);
        return { status: 201, body: project };
      }
      const project = projectList.find((p) => p.id === id);
      if (!project) return error(404, 'not_found');
      if (method === 'PATCH') {
        if (typeof b.name === 'string') {
          const name = clean(b.name);
          if (taken(name, project.id)) return error(409, 'project_exists');
          project.name = name;
        }
        if (typeof b.tone === 'string') project.tone = b.tone as Project['tone'];
        if (typeof b.archived === 'boolean') project.archived = b.archived;
        return { status: 200, body: project };
      }
    }
    if (resource === 'similar' && method === 'GET') {
      const target = stems(query.get('title') ?? '');
      if (target.size < 2) return { status: 200, body: [] };
      const found = tasks
        .filter((t) => !t.archived && t.status !== 'done')
        .map((t) => ({ t, n: [...stems(t.title)].filter((w) => target.has(w)).length }))
        .filter(({ n }) => n >= 2)
        .sort((x, y) => y.n - x.n)
        .slice(0, 2)
        .map(({ t }) => summary(t));
      return { status: 200, body: found };
    }

    if (resource === 'items') {
      if (!id && method === 'POST') {
        const from = letters.find((l) => l.id === b.letterId);
        return createTask(b, from);
      }
      const task = tasks.find((t) => t.id === id);
      if (!task) return error(404, 'not_found');
      if (!action && method === 'GET') return { status: 200, body: detail(task) };
      if (!action && method === 'PATCH') {
        // Преемник из заглушки «Ролей» может быть не из справочника задач — принимаем как есть
        const id = b.assigneeId ? String(b.assigneeId) : null;
        const to =
          allPeople.find((p) => p.id === id) ??
          (id ? { id, name: id, short: id, tone: 'blue' as const } : null);
        if (typeof b.title === 'string') task.title = b.title;
        if (typeof b.description === 'string') task.description = b.description;
        if ('priority' in b) task.priority = b.priority as TaskDetail['priority'];
        if ('projectId' in b) task.project = projectList.find((p) => p.id === b.projectId) ?? null;
        if (typeof b.due === 'string' && b.due !== task.due) {
          if (task.due) {
            log(task, 'due', `${task.due}|${b.due}`);
            task.rescheduleLog.push({ from: task.due, to: b.due as IsoDate, by: me });
          }
          task.due = b.due as IsoDate;
        }
        if (to && to.id !== task.assignee?.id) {
          log(task, 'assignee', `${task.assignee?.short ?? '—'}|${to.short}`);
          task.assignee = to;
        }
        return { status: 200, body: detail(task) };
      }
      if (action === 'move' && method === 'POST') {
        const column = columnOf(String(b.columnId));
        if (!column) return error(400, 'invalid');
        if (task.archived) return error(409, 'task_archived');
        if (column.id !== task.columnId) {
          if (column.wipLimit !== null && countIn(column.id) >= column.wipLimit) {
            return error(409, 'wip_limit', { limit: column.wipLimit });
          }
          const old = columnOf(task.columnId) as Column;
          log(task, 'status', `${old.name}|${column.name}`);
          task.columnId = column.id;
          task.status = column.stage;
        }
        // Место в колонке: перед beforeId или в конец; позиции колонки — заново по порядку
        const siblings = tasks
          .filter((t) => !t.archived && t.columnId === column.id && t.id !== task.id)
          .sort((x, y) => x.position - y.position);
        const at = siblings.findIndex((t) => t.id === b.beforeId);
        siblings.splice(at < 0 ? siblings.length : at, 0, task);
        siblings.forEach((t, i) => {
          t.position = i;
        });
        return { status: 200, body: summary(task) };
      }
      if (action === 'archive' && method === 'POST') {
        task.archived = Boolean(b.archived);
        return { status: 200, body: detail(task) };
      }
      if (action === 'subtasks' && method === 'POST') {
        const sub = { id: `s-new-${++seq}`, title: String(b.title), done: false, assignee: null };
        task.subtaskItems.push(sub);
        log(task, 'subtask', `added|${sub.title}`);
        return { status: 201, body: sub };
      }
      if (action === 'subtasks' && method === 'PATCH') {
        const sub = task.subtaskItems.find((s) => s.id === subId);
        if (!sub) return error(404, 'not_found');
        sub.done = Boolean(b.done);
        log(task, 'subtask', `${sub.done ? 'done' : 'undone'}|${sub.title}`);
        return { status: 200, body: sub };
      }
      if (action === 'comments' && method === 'POST') {
        const comment = { id: `c-new-${++seq}`, author: me, at: now(), text: String(b.text) };
        task.commentItems.push(comment);
        return { status: 201, body: { ...comment, author: apiPerson(me) } };
      }
      if (action === 'attachments' && method === 'POST') {
        const file = (body as FormData).get('file') as File;
        const item = { id: `att-new-${++seq}`, filename: file.name, size: file.size };
        task.attachmentItems.push(item);
        return { status: 201, body: item };
      }
    }

    if (resource === 'mail') {
      if (id === 'summary' && method === 'GET') {
        return {
          status: 200,
          body: {
            ready: letters.filter((l) => l.suggestion).length,
            manual: letters.filter((l) => !l.suggestion).length,
          },
        };
      }
      if (id === 'letters' && !action && method === 'GET') {
        return { status: 200, body: letters.map(letter) };
      }
      const letterId = action;
      const found = letters.find((l) => l.id === letterId);
      if (!found) return error(404, 'not_found');
      if (subId === 'accept' && method === 'POST') {
        if (!b.assigneeId) return error(400, 'assignee_required');
        if (!b.due) return error(400, 'due_required');
        return createTask(b, found);
      }
      if (subId === 'reject' && method === 'POST') {
        if (String(b.reason ?? '').trim().length < 5) return error(400, 'reason_required');
        letters = letters.filter((l) => l.id !== letterId);
        journalServer?.record('mailRejected', `${found.subject}: ${String(b.reason).trim()}`);
        return { status: 200, body: letter(found) };
      }
    }
    return error(404, 'not_found');
  }

  return {
    handle,
    tasks,
    columns,
    get letters() {
      return letters;
    },
  };
}

export type TasksServer = ReturnType<typeof createTasksServer>;

/** Сервер, установленный перед текущим тестом (src/test/setup.ts) */
export let tasksServer: TasksServer;

/**
 * Подменить fetch: /api/tasks/* и /api/auth/csrf отвечает подставной сервер задач,
 * остальное — прежний fetch. Снять — vi.unstubAllGlobals()
 */
export function installTasksServer(options?: { today?: IsoDate }) {
  tasksServer = createTasksServer(options);
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/tasks/') && path !== '/auth/csrf') return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const reply = tasksServer.handle(init.method ?? 'GET', path, url.searchParams, body);
      return reply.status === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(reply.body), {
            status: reply.status,
            headers: { 'Content-Type': 'application/json' },
          });
    }),
  );
  return tasksServer;
}
