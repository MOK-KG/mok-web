import { vi } from 'vitest';
import { tasksServer } from '@/features/tasks/testing/server';
import { addDays, nextWorkingDay, todayInBishkek } from '@/shared/lib/workDays';
import {
  type ApiNotification,
  lockedNotificationKinds,
  type NotificationSettings,
  notificationKinds,
} from '../api';

/**
 * Подставной бэкенд уведомлений для тестов: те же адреса и формат ответов, что у mok-backend
 * (apps/notifications/views.py). Данные — тексты макета, время относительно «сейчас», задачи —
 * из подставного сервера задач (эскалация, просрочка, срок через два дня). Права сервер здесь
 * не проверяет — экран фильтрует сам (canSeeNotification). Ставится в src/test/setup.ts
 * после сервера задач. Данные вымышленные (CLAUDE.md, «Данные»).
 */

type Reply = { status: number; body?: unknown };
type Seed = Omit<ApiNotification, 'id' | 'target' | 'params'> & {
  target: ApiNotification['target'] | { kind: 'task'; taskTitle: string };
};

function seed(now: number): Seed[] {
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    {
      kind: 'escalation',
      title: 'Эскалация · «Перевод устава на кыргызский»',
      text: 'Уведомление не открыто 4 часа. Передано директору департамента.',
      at: minutesAgo(12),
      read: false,
      target: { kind: 'task', taskTitle: 'Перевод устава на кыргызский язык' },
    },
    {
      kind: 'overdue',
      title: 'Срок истёк · «Ответить на запрос МОК»',
      text: 'Просрочено на 1 день. Вы — исполнитель.',
      at: minutesAgo(60),
      read: false,
      target: { kind: 'task', taskTitle: 'Ответить на запрос МОК по антидопинговой программе' },
    },
    {
      kind: 'mailQueue',
      title: '4 письма в очереди из почты',
      text: 'info@olympic.kg · ждут проверки перед созданием задач.',
      at: minutesAgo(120),
      read: false,
      target: { kind: 'mailQueue' },
    },
    {
      kind: 'mention',
      title: 'Д. Токтосунова упомянула вас в чате',
      text: 'Канал «Медицинский» — нужен комментарий по статье 4.2 сметы.',
      at: minutesAgo(180),
      read: false,
      target: { kind: 'chat', chatId: 'c-medical' },
    },
    {
      kind: 'reminder',
      title: 'Напоминание · «Обновить регламент аккредитации»',
      // Текст — дата срока: срок задачи через два дня (на рабочий день)
      text: nextWorkingDay(addDays(todayInBishkek(), 2)),
      at: minutesAgo(24 * 60),
      read: true,
      target: { kind: 'task', taskTitle: 'Обновить регламент аккредитации журналистов' },
    },
    {
      kind: 'done',
      title: '«Квартальный отчёт для ОКС» завершён',
      text: 'К. Асанов перевёл задачу в «Готово».',
      at: minutesAgo(26 * 60),
      read: true,
      target: null,
    },
  ];
}

const allOn = () =>
  Object.fromEntries(notificationKinds.map((k) => [k, true])) as NotificationSettings;

export function createNotificationsServer({ now = Date.now() }: { now?: number } = {}) {
  // id задачи — как у задачи с тем же названием в подставном сервере задач
  const taskId = (title: string) => tasksServer?.tasks.find((t) => t.title === title)?.id ?? '';
  const items: ApiNotification[] = seed(now).map(({ target, ...n }, i) => ({
    ...n,
    id: i + 1,
    params: null,
    target:
      target?.kind === 'task'
        ? { kind: 'task', taskTitle: target.taskTitle, taskId: taskId(target.taskTitle) }
        : target,
  }));
  let settings = allOn();
  /** Браузерные уведомления: включены ли на «сервере» и чьи подписки есть */
  const webPush = { enabled: false, publicKey: 'BTestKey', endpoints: [] as string[] };

  const visible = () => items.filter((n) => settings[n.kind]);

  /** Добавить уведомление (как сделал бы бэкенд по событию) */
  function push(n: Omit<ApiNotification, 'id'>) {
    const item = { ...n, id: items.length + 1 };
    items.unshift(item);
    return item;
  }

  function handle(method: string, path: string, body?: Record<string, unknown>): Reply {
    if (path === '/notifications/' && method === 'GET') return { status: 200, body: visible() };
    if (path === '/notifications/read-all' && method === 'POST') {
      const unread = visible().filter((n) => !n.read);
      for (const n of unread) n.read = true;
      return { status: 200, body: { updated: unread.length } };
    }
    const read = path.match(/^\/notifications\/(\d+)\/read$/);
    if (read && method === 'POST') {
      const n = visible().find((x) => x.id === Number(read[1]));
      if (!n) return { status: 404, body: { code: 'not_found', detail: 'not_found' } };
      n.read = true;
      return { status: 200, body: n };
    }
    if (path === '/notifications/web-push' && method === 'GET') {
      const { enabled, publicKey } = webPush;
      return { status: 200, body: { enabled, publicKey: enabled ? publicKey : '' } };
    }
    if (path === '/notifications/web-push' && method === 'POST') {
      if (!webPush.enabled) return { status: 409, body: { code: 'web_push_disabled' } };
      const endpoint = String(body?.endpoint);
      if (!webPush.endpoints.includes(endpoint)) webPush.endpoints.push(endpoint);
      return { status: 204 };
    }
    if (path === '/notifications/web-push' && method === 'DELETE') {
      webPush.endpoints = webPush.endpoints.filter((e) => e !== body?.endpoint);
      return { status: 204 };
    }
    if (path === '/notifications/settings' && method === 'GET') {
      return { status: 200, body: settings };
    }
    if (path === '/notifications/settings' && method === 'PUT') {
      settings = { ...allOn(), ...(body as NotificationSettings) };
      for (const k of lockedNotificationKinds) settings[k] = true;
      return { status: 200, body: settings };
    }
    if (path === '/notifications/counters' && method === 'GET') {
      return {
        status: 200,
        body: { notifications: visible().filter((n) => !n.read).length, chat: 0, documents: 0 },
      };
    }
    return { status: 404, body: { code: 'not_found', detail: 'not_found' } };
  }

  return {
    handle,
    items,
    push,
    webPush,
    get settings() {
      return settings;
    },
  };
}

export type NotificationsServer = ReturnType<typeof createNotificationsServer>;

/** Сервер, установленный перед текущим тестом (src/test/setup.ts) */
export let notificationsServer: NotificationsServer;

/** Подменить fetch: /api/notifications/* отвечает подставной сервер, остальное — прежний fetch */
export function installNotificationsServer(options?: { now?: number }) {
  notificationsServer = createNotificationsServer(options);
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/notifications/')) return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      const reply = notificationsServer.handle(init.method ?? 'GET', path, body);
      return new Response(reply.status === 204 ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return notificationsServer;
}
