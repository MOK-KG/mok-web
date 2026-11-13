import { vi } from 'vitest';
import type { JournalAction } from '@/features/journal/store';
import { journalServer } from '@/features/journal/testing/server';
import type { ApiPerson } from '@/features/tasks/api';
import { currentUserId, people } from '@/features/tasks/directory';
import { tasksServer } from '@/features/tasks/testing/server';
import type { Person } from '@/features/tasks/types';
import { type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import type { ApiDocument } from '../api';
import { defaultReplyDue, deliver, isEmail } from '../correspondence';
import { defaultLetter, type Letter, letterFingerprint } from '../letter';
import { createMockDocuments } from '../mock';
import type { DocCategory, DocHistoryEntry, DocKind, DocumentRecord } from '../types';

/**
 * Подставной бэкенд делопроизводства для тестов: те же адреса и формат ответов, что у
 * mok-backend (apps/documents/views.py), данные — из mock.ts. Подменяет fetch только для
 * /api/documents/*; остальное уходит дальше. Ставится перед каждым тестом в src/test/setup.ts
 * (после сервера задач: резолюция создаёт задачу в нём).
 *
 * Текущий сотрудник — Айбек Дуйшеев (currentUserId). Права не проверяются — их проверяют тесты
 * бэкенда. Доставка по почте — как в заглушке: известный домен доставлен, неизвестный — нет.
 */

type Reply = { status: number; body?: unknown };
type Body = Record<string, unknown>;

const apiPerson = (p: Person): ApiPerson => ({
  id: p.id,
  email: `${p.id}@olympic.kg`,
  name: p.name,
  position: '',
  department: p.unit ?? '',
});

const error = (status: number, code: string, field?: string): Reply => ({
  status,
  body: { code, detail: code, ...(field ? { fields: { [field]: code } } : {}) },
});

const prefixes: Record<DocKind, string> = { incoming: 'Вх.', outgoing: 'Исх.', order: 'Приказ' };

const numberOf = (d: DocumentRecord) =>
  d.seq === null
    ? null
    : `${prefixes[d.kind]} №${d.kind === 'order' ? d.seq : `${d.year}-${String(d.seq).padStart(4, '0')}`}`;

export function createDocumentsServer({ today = todayInBishkek() }: { today?: IsoDate } = {}) {
  // Срок и ссылка в резолюции — по задаче из сервера задач (как на бэкенде: Resolution.task)
  const taskOf = (title: string) => tasksServer?.tasks.find((t) => t.title === title);
  const docs = createMockDocuments(today, (title) => taskOf(title)?.due ?? null);
  for (const d of docs) {
    const task = d.resolution?.taskTitle ? taskOf(d.resolution.taskTitle) : undefined;
    if (d.resolution && task) Object.assign(d.resolution, { taskId: task.id, taskCode: task.code });
  }
  const me = Object.values(people).find((p) => p.id === currentUserId) as Person;
  const year = Number(today.slice(0, 4));
  let seq = 0;

  const now = () => new Date().toISOString();
  const log = (d: DocumentRecord, kind: DocHistoryEntry['kind'], text = '') =>
    d.history.unshift({ id: `dh-srv-${++seq}`, kind, at: now(), by: me, text });
  const journal = (action: JournalAction, d: DocumentRecord) =>
    journalServer?.record(action, `${numberOf(d) ?? d.title} · ${d.title}`);
  const next = (kind: DocKind) =>
    docs
      .filter((d) => d.kind === kind && d.year === year && d.seq !== null)
      .reduce((max, d) => Math.max(max, d.seq as number), 0) + 1;

  function toApi(d: DocumentRecord, withHistory: boolean): ApiDocument {
    const { history, ...rest } = d;
    return {
      ...rest,
      number: numberOf(d),
      author: apiPerson(d.author),
      signer: d.signer && apiPerson(d.signer),
      resolution: d.resolution && {
        ...d.resolution,
        author: apiPerson(d.resolution.author),
        assignee: apiPerson(d.resolution.assignee),
      },
      annulment: d.annulment && { ...d.annulment, by: apiPerson(d.annulment.by) },
      ...(withHistory ? { history: history.map((h) => ({ ...h, by: apiPerson(h.by) })) } : {}),
    };
  }

  const ok = (d: DocumentRecord, status = 200): Reply => ({ status, body: toApi(d, true) });

  function sendByEmail(d: DocumentRecord, email: string) {
    const result = deliver(email);
    d.delivery = {
      email: email.trim(),
      status: result.status,
      error: result.error,
      at: now(),
      attempts: (d.delivery?.attempts ?? 0) + 1,
    };
    if (result.status === 'bounced') {
      log(d, 'bounced', `${email.trim()}: ${result.error}`);
      journal('documentBounced', d);
    }
  }

  const base = (kind: DocKind, b: Body): DocumentRecord => ({
    id: `doc-${kind}-srv-${++seq}`,
    kind,
    status: 'draft',
    seq: null,
    year,
    date: today,
    title: String(b.title ?? '').trim(),
    party: kind === 'order' ? null : String(b.party ?? '').trim(),
    senderRef: null,
    summary: String(b.summary ?? '').trim(),
    attachments: [],
    author: me,
    signer: null,
    resolution: null,
    annulment: null,
    history: [],
    category: null,
    replyDue: null,
    replyTo: null,
    delivery: null,
    letter: null,
    fingerprint: null,
  });

  function register(b: Body): Reply {
    if (String(b.title ?? '').trim().length < 3) return error(400, 'title_short', 'title');
    if (String(b.party ?? '').trim().length < 2) return error(400, 'party_short', 'party');
    const category = (b.category as DocCategory) ?? 'other';
    const d: DocumentRecord = {
      ...base('incoming', b),
      status: 'registered',
      seq: next('incoming'),
      senderRef: String(b.senderRef ?? '').trim() || null,
      category,
      replyDue:
        'replyDue' in b ? ((b.replyDue as IsoDate) ?? null) : defaultReplyDue(category, today),
    };
    docs.push(d);
    log(d, 'registered');
    journal('documentRegistered', d);
    return ok(d, 201);
  }

  function draft(b: Body): Reply {
    const kind = b.kind as DocKind;
    if (kind !== 'outgoing' && kind !== 'order') return error(400, 'kind_invalid', 'kind');
    if (String(b.title ?? '').trim().length < 3) return error(400, 'title_short', 'title');
    if (kind === 'outgoing' && String(b.party ?? '').trim().length < 2) {
      return error(400, 'party_short', 'party');
    }
    const email = String(b.email ?? '').trim();
    if (email && !isEmail(email)) return error(400, 'email_invalid', 'email');
    const d = base(kind, b);
    if (kind === 'outgoing') {
      d.letter = (b.letter as Letter | null) ?? { ...defaultLetter(d.party, d.summary), email };
      d.replyTo = (b.replyTo as string | null) ?? null;
    }
    docs.push(d);
    log(d, 'created');
    return ok(d, 201);
  }

  function act(d: DocumentRecord, name: string, b: Body): Reply {
    const wrong = () => ({ status: 409, body: { code: 'document_status', status: d.status } });
    switch (name) {
      case 'issue': {
        if (d.status !== 'draft') return wrong();
        d.seq = next(d.kind);
        d.year = year;
        d.date = today;
        d.signer = me;
        d.status = d.kind === 'outgoing' ? 'sent' : 'signed';
        if (d.kind === 'outgoing') {
          d.letter ??= defaultLetter(d.party, d.summary);
          d.fingerprint = letterFingerprint({
            number: numberOf(d),
            date: d.date,
            title: d.title,
            letter: d.letter,
            signer: me.short,
          });
        }
        log(d, d.kind === 'outgoing' ? 'sent' : 'signed');
        journal('documentSent', d);
        if (d.kind === 'outgoing' && d.letter?.email) sendByEmail(d, d.letter.email);
        return ok(d);
      }
      case 'letter': {
        if (d.kind !== 'outgoing') return error(400, 'not_letter');
        if (d.status !== 'draft') return error(409, 'document_immutable');
        const letter = b.letter as Letter;
        d.letter = { ...letter, addressee: letter.addressee.trim(), body: letter.body.trim() };
        if (String(b.title ?? '').trim()) d.title = String(b.title).trim();
        log(d, 'edited');
        return ok(d);
      }
      case 'resend': {
        if (d.kind !== 'outgoing') return error(400, 'not_letter');
        if (d.status !== 'sent') return wrong();
        const email = String(b.email ?? '').trim();
        if (!isEmail(email)) return error(400, 'email_invalid', 'email');
        log(d, 'resent', email);
        sendByEmail(d, email);
        return ok(d);
      }
      case 'resolve': {
        if (d.status !== 'registered') return wrong();
        const text = String(b.text ?? '').trim();
        if (text.length < 3) return error(400, 'resolution_short', 'text');
        const assignee = Object.values(people).find((p) => p.id === b.assigneeId);
        if (!assignee) return error(400, 'assignee_inactive', 'assigneeId');
        const created = tasksServer.handle('POST', '/tasks/items', new URLSearchParams(), {
          title: d.title,
          description: `${numberOf(d)} · ${d.party}\n\n${text}`,
          assigneeId: assignee.id,
          due: b.due,
          priority: 'normal',
        });
        if (created.status !== 201) return created;
        const task = created.body as { id: string; code: string; title: string };
        d.resolution = {
          text,
          author: me,
          at: now(),
          assignee,
          due: b.due as IsoDate,
          taskTitle: task.title,
          taskId: task.id,
          taskCode: task.code,
        };
        d.status = 'inWork';
        log(d, 'resolution', text);
        journal('documentResolved', d);
        return ok(d);
      }
      case 'done':
        if (d.status !== 'inWork') return wrong();
        d.status = 'done';
        log(d, 'done');
        journal('documentDone', d);
        return ok(d);
      case 'annul': {
        if (d.status === 'annulled') return wrong();
        const reason = String(b.reason ?? '').trim();
        if (reason.length < 5) return error(400, 'reason_required', 'reason');
        d.status = 'annulled';
        d.annulment = { reason, by: me, at: now() };
        log(d, 'annulled', reason);
        journal('documentAnnulled', d);
        return ok(d);
      }
      default:
        return error(404, 'not_found');
    }
  }

  function upload(d: DocumentRecord, body: unknown): Reply {
    if (d.status === 'annulled') return error(409, 'document_status');
    if (d.kind !== 'incoming' && d.status !== 'draft') return error(409, 'document_immutable');
    const file = body instanceof FormData ? (body.get('file') as File | null) : null;
    if (!file) return error(400, 'file_required', 'file');
    const attachment = { id: `${d.id}-srv-a${++seq}`, name: file.name, size: file.size };
    d.attachments.push(attachment);
    return { status: 201, body: attachment };
  }

  function handle(method: string, path: string, body: unknown): Reply {
    const b = (body ?? {}) as Body;
    const [, , resource, id, name] = path.split('/');
    if (resource === 'awaiting' && method === 'GET') {
      const count = docs.filter((d) => d.kind === 'incoming' && d.status === 'registered').length;
      return { status: 200, body: { count } };
    }
    if (resource !== 'items') return error(404, 'not_found');
    if (!id && method === 'GET') {
      const sorted = [...docs].sort(
        (x, y) =>
          Number(y.seq === null) - Number(x.seq === null) ||
          y.date.localeCompare(x.date) ||
          (y.seq ?? 0) - (x.seq ?? 0),
      );
      return { status: 200, body: sorted.map((d) => toApi(d, false)) };
    }
    if (id === 'incoming' && method === 'POST') return register(b);
    if (id === 'drafts' && method === 'POST') return draft(b);
    const d = docs.find((x) => x.id === id);
    if (!d) return error(404, 'not_found');
    if (!name && method === 'GET') return ok(d);
    if (name === 'attachments' && method === 'POST') return upload(d, body);
    if (method === 'POST') return act(d, name, b);
    return error(405, 'method_not_allowed');
  }

  return { handle, docs };
}

export type DocumentsServer = ReturnType<typeof createDocumentsServer>;

/** Сервер, установленный перед текущим тестом (src/test/setup.ts) */
export let documentsServer: DocumentsServer;

/** Подменить fetch: /api/documents/* отвечает подставной сервер, остальное — прежний fetch */
export function installDocumentsServer(options?: { today?: IsoDate }) {
  documentsServer = createDocumentsServer(options);
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/documents/')) return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const reply = documentsServer.handle(init.method ?? 'GET', path, body);
      return new Response(JSON.stringify(reply.body ?? null), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return documentsServer;
}
