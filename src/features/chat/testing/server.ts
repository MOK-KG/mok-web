import { vi } from 'vitest';
import { absencesServer, sessionPerson } from '@/features/absences/testing/server';
import { tasksServer } from '@/features/tasks/testing/server';
import { diffDays, todayInBishkek } from '@/shared/lib/workDays';
import type {
  ApiChatFile,
  ApiChatMember,
  ApiChatMessage,
  ApiChatSummary,
  ApiSearchHit,
} from '../api';
import { chatMembers, createMockChat } from '../mock';
import type { Chat, ChatMessage } from '../types';

/**
 * Подставной бэкенд чата для тестов: те же адреса и формат, что у mok-backend
 * (apps/chat/views.py), данные — заглушка mock.ts. Подменяет fetch только для /api/chat/*;
 * остальное уходит дальше. Ставится перед каждым тестом в src/test/setup.ts.
 *
 * Текущий сотрудник — из сессии заглушки входа (без неё — Айбек Дуйшеев). В заглушке «прочитано
 * до» общее для чата — тесты смотрят от лица одного сотрудника.
 */

type Reply = { status: number; body?: unknown };
type Body = Record<string, unknown>;

const error = (status: number, code: string): Reply => ({
  status,
  body: { code, detail: code },
});

/** Как search_stems на бэкенде и searchStems во фронте */
const normalize = (text: string) => text.toLowerCase().replaceAll('ё', 'е');
const stemsOf = (query: string) =>
  normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => (w.length > 5 ? w.slice(0, -2) : w))
    .filter((s) => s.length >= 2);

export function createChatServer(now?: number) {
  const store = createMockChat(now);
  let seq = 0;

  const apiMember = (id: string): ApiChatMember => {
    const m = chatMembers[id];
    return {
      id: m.id,
      email: `${m.id}@olympic.kg`,
      name: m.name,
      position: '',
      department: m.department,
      role: m.role,
      active: true,
    };
  };

  const toApi = (m: ChatMessage): ApiChatMessage => ({
    id: m.id,
    chatId: m.chatId,
    authorId: m.authorId,
    at: m.at,
    kind: m.kind,
    text: m.text,
    threadId: m.threadId ?? null,
    task: m.task ?? null,
    system: m.system ?? null,
    file: m.file ? { size: 1, ...m.file } : null,
  });

  const me = () => sessionPerson().id;
  const mine = () => store.chats.filter((c) => c.memberIds.includes(me()));
  const own = (chatId: string) => store.messages.filter((m) => m.chatId === chatId);
  const unreadOf = (chat: Chat) =>
    own(chat.id).filter((m) => m.authorId !== me() && m.at > chat.readAt).length;
  const titleOf = (chat: Chat) =>
    chat.kind === 'direct'
      ? (chatMembers[chat.memberIds.find((id) => id !== me()) ?? '']?.name ?? chat.title)
      : chat.title;

  const summary = (chat: Chat): ApiChatSummary => {
    const peerId =
      chat.kind === 'direct' ? (chat.memberIds.find((id) => id !== me()) ?? null) : null;
    const last =
      own(chat.id)
        .filter((m) => !m.threadId)
        .at(-1) ?? null;
    return {
      ...structuredClone(chat),
      title: titleOf(chat),
      fullTitle: chat.kind === 'direct' ? titleOf(chat) : chat.fullTitle,
      description: chat.description ?? '',
      createdById: chat.createdById ?? null,
      createdAt: chat.createdAt ?? chat.readAt,
      peerId,
      last: last && toApi(last),
      unread: unreadOf(chat),
    };
  };

  const summaries = () =>
    mine()
      .map(summary)
      .sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''));

  /** Как services.send: в личной переписке с отсутствующим сегодня — автоответ */
  function send(chat: Chat, message: Omit<ChatMessage, 'id' | 'chatId' | 'authorId' | 'at'>) {
    const at = new Date().toISOString();
    const sent: ChatMessage = {
      id: `m-new-${++seq}`,
      chatId: chat.id,
      authorId: me(),
      at,
      ...message,
    };
    store.messages.push(sent);
    chat.readAt = at;
    const peer = chat.kind === 'direct' ? chat.memberIds.find((id) => id !== me()) : undefined;
    const today = todayInBishkek();
    const absence = absencesServer?.absences.find(
      (a) =>
        a.status === 'active' &&
        a.person.id === peer &&
        diffDays(a.from, today) >= 0 &&
        diffDays(today, a.to) >= 0,
    );
    if (absence) {
      store.messages.push({
        id: `m-new-${++seq}`,
        chatId: chat.id,
        authorId: null,
        at,
        kind: 'system',
        text: absence.deputy.short,
        system: { kind: 'autoreply', title: absence.to },
      });
    }
    return sent;
  }

  function handle(method: string, path: string, query: URLSearchParams, body: unknown): Reply {
    const b = (body ?? {}) as Body;
    if (path === '/chat/members' && method === 'GET') {
      return { status: 200, body: Object.keys(chatMembers).map(apiMember) };
    }
    if (path === '/chat/chats' && method === 'GET') return { status: 200, body: summaries() };
    if (path === '/chat/unread' && method === 'GET') {
      return { status: 200, body: { total: mine().reduce((n, c) => n + unreadOf(c), 0) } };
    }
    if (path === '/chat/chats/direct' && method === 'POST') {
      const peerId = String(b.peerId);
      if (!chatMembers[peerId]) return error(404, 'member_not_found');
      if (peerId === me()) return error(400, 'direct_self');
      const existing = store.chats.find(
        (c) => c.kind === 'direct' && c.memberIds.includes(peerId) && c.memberIds.includes(me()),
      );
      if (existing) return { status: 200, body: summary(existing) };
      const chat: Chat = {
        id: `c-new-${++seq}`,
        kind: 'direct',
        title: chatMembers[peerId].name,
        fullTitle: chatMembers[peerId].name,
        memberIds: [me(), peerId],
        peerId,
        readAt: new Date().toISOString(),
        muted: false,
      };
      store.chats.push(chat);
      return { status: 201, body: summary(chat) };
    }
    if (path === '/chat/chats/groups' && method === 'POST') {
      const title = String(b.title ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .join(' ');
      if (title.length < 2 || title.length > 80) return error(400, 'group_title');
      const ids = ((b.memberIds as string[] | undefined) ?? []).filter((id) => id !== me());
      if (ids.some((id) => !chatMembers[id])) return error(404, 'member_not_found');
      if (ids.length === 0) return error(400, 'group_members');
      const at = new Date().toISOString();
      const chat: Chat = {
        id: `c-new-${++seq}`,
        kind: 'group',
        title,
        fullTitle: title,
        description: String(b.description ?? '').trim(),
        createdById: me(),
        createdAt: at,
        memberIds: [me(), ...new Set(ids)],
        peerId: null,
        readAt: at,
        muted: false,
      };
      store.chats.push(chat);
      return { status: 201, body: summary(chat) };
    }
    const group = path.match(/^\/chat\/chats\/([^/]+)(?:\/members(?:\/([^/]+))?)?$/);
    if (group) {
      const chat = mine().find((c) => c.id === group[1]);
      if (!chat) return error(404, 'not_found');
      if (chat.kind !== 'group') return error(409, 'not_group');
      const [, , memberId] = group;
      const isMembers = path.includes('/members');
      if (!isMembers && method === 'PATCH') {
        if (b.title !== undefined) {
          const title = String(b.title).trim();
          if (title.length < 2 || title.length > 80) return error(400, 'group_title');
          chat.title = chat.fullTitle = title;
        }
        if (b.description !== undefined) chat.description = String(b.description).trim();
        return { status: 200, body: summary(chat) };
      }
      if (isMembers && !memberId && method === 'POST') {
        const ids = (b.memberIds as string[]) ?? [];
        if (ids.some((id) => !chatMembers[id])) return error(404, 'member_not_found');
        chat.memberIds = [...new Set([...chat.memberIds, ...ids])];
        return { status: 200, body: summary(chat) };
      }
      if (memberId && method === 'DELETE') {
        if (memberId !== me() && chat.createdById !== me()) return error(403, 'group_forbidden');
        if (!chat.memberIds.includes(memberId)) return error(404, 'member_not_found');
        const left = memberId === me();
        chat.memberIds = chat.memberIds.filter((id) => id !== memberId);
        return left ? { status: 204 } : { status: 200, body: summary(chat) };
      }
      return error(405, 'method_not_allowed');
    }
    if (path === '/chat/files' && method === 'GET') {
      const ids = new Set(mine().map((c) => c.id));
      const files: ApiChatFile[] = store.messages.flatMap((m) => {
        const chat = store.chats.find((c) => c.id === m.chatId);
        if (!m.file || !chat || !ids.has(chat.id)) return [];
        return [
          {
            messageId: m.id,
            chatId: chat.id,
            chatTitle: titleOf(chat),
            name: m.file.name,
            ext: m.file.ext,
            size: 1,
            authorId: m.authorId,
            at: m.at,
          },
        ];
      });
      return { status: 200, body: files };
    }
    if (path === '/chat/search' && method === 'GET') {
      const stems = stemsOf(query.get('q') ?? '');
      const ids = new Set(mine().map((c) => c.id));
      const hits: ApiSearchHit[] =
        stems.length === 0
          ? []
          : store.messages
              .filter((m) => ids.has(m.chatId) && m.kind === 'text')
              .filter((m) => {
                const text = normalize(`${m.text} ${m.file?.name ?? ''}`);
                return stems.every((s) => text.includes(s));
              })
              .map((m) => {
                const chat = store.chats.find((c) => c.id === m.chatId) as Chat;
                return {
                  message: toApi(m),
                  chatTitle: titleOf(chat),
                  author: m.authorId ? (chatMembers[m.authorId]?.short ?? null) : null,
                };
              });
      return { status: 200, body: hits };
    }

    const match = path.match(/^\/chat\/chats\/([^/]+)\/(messages|files|read|mute)$/);
    if (!match) return error(404, 'not_found');
    const chat = mine().find((c) => c.id === match[1]);
    if (!chat) return error(404, 'not_found');
    const action = match[2];
    if (action === 'messages' && method === 'GET') {
      const list = own(chat.id);
      const after = query.get('after');
      const from = after ? list.findIndex((m) => m.id === after) + 1 : 0;
      return { status: 200, body: list.slice(from).map(toApi) };
    }
    if (action === 'messages' && method === 'POST') {
      const text = String(b.text ?? '').trim();
      const kind = b.kind === 'task' ? 'task' : 'text';
      const threadId = b.threadId ? String(b.threadId) : undefined;
      if (kind === 'text' && !text) return error(400, 'text_required');
      if (kind === 'task') {
        const task = tasksServer?.tasks.find((t) => t.id === b.taskId);
        if (!task) return error(404, 'task_not_found');
        const sent = send(chat, {
          kind,
          text: '',
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
            assignee: task.assignee?.short ?? '—',
            due: task.due,
          },
        });
        return { status: 201, body: toApi(sent) };
      }
      return { status: 201, body: toApi(send(chat, { kind, text, threadId })) };
    }
    if (action === 'files' && method === 'POST') {
      const form = body as FormData;
      const file = form.get('file') as File;
      const dot = file.name.lastIndexOf('.');
      const sent = send(chat, {
        kind: 'text',
        text: String(form.get('text') ?? ''),
        file: {
          name: dot > 0 ? file.name.slice(0, dot) : file.name,
          ext: dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '',
        },
        ...(form.get('threadId') ? { threadId: String(form.get('threadId')) } : {}),
      });
      return { status: 201, body: toApi(sent) };
    }
    if (action === 'read' && method === 'POST') {
      const last = own(chat.id).at(-1);
      if (last && last.at > chat.readAt) chat.readAt = last.at;
      return { status: 200, body: summary(chat) };
    }
    if (action === 'mute' && method === 'POST') {
      chat.muted = Boolean(b.muted);
      return { status: 200, body: summary(chat) };
    }
    return error(405, 'method_not_allowed');
  }

  return { handle, store };
}

export type ChatServer = ReturnType<typeof createChatServer>;

/** Сервер, установленный перед текущим тестом (src/test/setup.ts) */
export let chatServer: ChatServer | undefined;

/** Подменить fetch: /api/chat/* отвечает подставной сервер чата */
export function installChatServer(now?: number) {
  const server = createChatServer(now);
  chatServer = server;
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/chat/')) return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const reply = server.handle(init.method ?? 'GET', path, url.searchParams, body);
      return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? null), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return server;
}
