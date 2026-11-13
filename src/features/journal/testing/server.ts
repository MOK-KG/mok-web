import { vi } from 'vitest';
import {
  type ApiJournalEntry,
  type JournalAction,
  type JournalGroup,
  journalGroups,
  resetJournal,
} from '../store';

/**
 * Подставной бэкенд журнала действий для тестов: те же адреса и формат ответов, что у
 * mok-backend (apps/journal/views.py). Подменяет fetch только для /api/journal/*; остальное
 * уходит дальше. Ставится перед каждым тестом в src/test/setup.ts.
 *
 * Автор записи — из сессии заглушки входа (sessionStorage), без неё — «А. Дуйшеев».
 * Хеш — FNV-1a (только чтобы была цепочка); на сервере — SHA-256.
 */

type Reply = { status: number; body?: unknown };
type Body = Record<string, unknown>;

const GENESIS = '0'.repeat(64);
const SESSION_KEY = 'nok.mockSession';

/** Действия, которые фронт пока пишет сам (белый список временного POST на бэкенде) */
const FRONT_ACTIONS: JournalAction[] = ['accessDenied'];

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const hashOf = (e: Omit<ApiJournalEntry, 'id' | 'hash'>) =>
  fnv([e.prevHash, e.at, e.authorId, e.author, e.action, e.details, e.reason, e.target].join('|'));

const shortName = (name: string) => {
  const [first, ...rest] = name.split(' ');
  return rest.length ? `${first.charAt(0)}. ${rest.join(' ')}` : name;
};

function sessionAuthor(): { id: string; name: string } {
  const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SESSION_KEY);
  if (!raw) return { id: 'ad', name: 'А. Дуйшеев' };
  const { user } = JSON.parse(raw) as { user: { email: string; name: string } };
  return { id: user.email, name: shortName(user.name) };
}

const groupOf = (action: JournalAction) =>
  (Object.keys(journalGroups) as JournalGroup[]).find((g) =>
    (journalGroups[g] as readonly string[]).includes(action),
  ) ?? 'access';

export function createJournalServer({ seed = false }: { seed?: boolean } = {}) {
  const entries: ApiJournalEntry[] = [];
  let seq = 0;

  function record(
    action: JournalAction,
    details = '',
    { reason = '', target = '', author = sessionAuthor() } = {},
  ): ApiJournalEntry {
    const base = {
      at: new Date().toISOString(),
      author: author.name,
      authorId: author.id,
      action,
      details,
      reason,
      target,
      prevHash: entries.at(-1)?.hash ?? GENESIS,
    };
    const entry = { id: String(++seq), ...base, hash: hashOf(base) };
    entries.push(entry);
    return entry;
  }

  if (seed) {
    record('userInvited', 'Нурлан Бакиров · n.bakirov@olympic.kg');
    record('roleChanged', 'Д. Токтосунова: R8 → R5');
    record('documentRegistered', 'Вх. №2026-0896 · О предоставлении спортивных объектов');
    record('accessDenied', '/access · staff.view', {
      author: { id: 'nb', name: 'Н. Бакиров' },
    });
  }

  function verify() {
    let prev = GENESIS;
    for (let i = 0; i < entries.length; i++) {
      const { id, hash, ...rest } = entries[i];
      if (rest.prevHash !== prev || hash !== hashOf(rest)) {
        return { ok: false, checked: i + 1, brokenAt: id };
      }
      prev = hash;
    }
    return { ok: true, checked: entries.length, brokenAt: null };
  }

  function list(query: URLSearchParams) {
    const needle = (query.get('q') ?? '').trim().toLocaleLowerCase('ru');
    const qActions = (query.get('qActions') ?? '').split(',');
    const from = query.get('dateFrom');
    const to = query.get('dateTo');
    const matched = entries
      .filter((e) => !query.get('action') || e.action === query.get('action'))
      .filter((e) => !query.get('author') || e.authorId === query.get('author'))
      .filter((e) => !from || e.at.slice(0, 10) >= from)
      .filter((e) => !to || e.at.slice(0, 10) <= to)
      .filter(
        (e) =>
          !needle ||
          qActions.includes(e.action) ||
          [e.author, e.details, e.reason, e.target].some((v) =>
            v.toLocaleLowerCase('ru').includes(needle),
          ),
      )
      .reverse();
    const counts = Object.fromEntries(
      (Object.keys(journalGroups) as JournalGroup[]).map((g) => [
        g,
        matched.filter((e) => groupOf(e.action) === g).length,
      ]),
    );
    const group = query.get('group') as JournalGroup | null;
    const inGroup = group ? matched.filter((e) => groupOf(e.action) === group) : matched;
    const before = query.get('before');
    const rest = before ? inGroup.filter((e) => Number(e.id) < Number(before)) : inGroup;
    const limit = Number(query.get('limit') ?? 200);
    return {
      items: rest.slice(0, limit),
      total: inGroup.length,
      counts,
      hasMore: rest.length > limit,
      size: entries.length,
    };
  }

  function csv() {
    const cell = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const head = 'id;at;author;action;details;reason;target;prevHash;hash';
    const rows = entries.map((e) =>
      [e.id, e.at, e.author, e.action, e.details, e.reason, e.target, e.prevHash, e.hash]
        .map(cell)
        .join(';'),
    );
    return `﻿${[head, ...rows].join('\n')}\n`;
  }

  function handle(method: string, path: string, query: URLSearchParams, body?: Body): Reply {
    if (path === '/journal/entries' && method === 'GET') return { status: 200, body: list(query) };
    if (path === '/journal/entries' && method === 'POST') {
      const action = String(body?.action) as JournalAction;
      if (!FRONT_ACTIONS.includes(action)) {
        return { status: 400, body: { code: 'action_not_allowed', detail: 'action_not_allowed' } };
      }
      const entry = record(action, String(body?.details ?? ''), {
        reason: String(body?.reason ?? ''),
        target: String(body?.target ?? ''),
      });
      return { status: 201, body: entry };
    }
    if (path === '/journal/verify' && method === 'GET') return { status: 200, body: verify() };
    if (path === '/journal/export' && method === 'GET') {
      const reason = (query.get('reason') ?? '').trim();
      if (reason.length < 5) {
        return {
          status: 400,
          body: { code: 'reason_required', detail: 'reason_required', fields: { reason: '' } },
        };
      }
      record('journalExported', `CSV, записей: ${entries.length + 1}`, { reason });
      return { status: 200, body: csv() };
    }
    return { status: 404, body: { code: 'not_found', detail: 'not_found' } };
  }

  return { handle, record, verify, entries };
}

export type JournalServer = ReturnType<typeof createJournalServer>;

/** Сервер, установленный перед текущим тестом (src/test/setup.ts) */
export let journalServer: JournalServer;

/** Подменить fetch: /api/journal/* отвечает подставной сервер, остальное — прежний fetch */
export function installJournalServer(options?: { seed?: boolean }) {
  journalServer = createJournalServer(options);
  resetJournal();
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/journal/')) return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      const reply = journalServer.handle(init.method ?? 'GET', path, url.searchParams, body);
      return new Response(
        typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body),
        {
          status: reply.status,
          headers: {
            'Content-Type': typeof reply.body === 'string' ? 'text/csv' : 'application/json',
          },
        },
      );
    }),
  );
  return journalServer;
}
