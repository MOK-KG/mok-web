import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addJournalEntry, createTask, tasksKey } from '@/features/tasks/api';
import { currentUserId, people } from '@/features/tasks/directory';
import { createMockTasks } from '@/features/tasks/mock';
import type { Person } from '@/features/tasks/types';
import type { FeedbackMeta } from '@/shared/api/feedback';
import { type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { createMockDocuments } from './mock';
import type { DocHistoryEntry, DocKind, DocStatus, DocumentRecord } from './types';

/**
 * Данные делопроизводства. Пока бэкенда нет — заглушка в памяти (mock.ts); номера выдаёт
 * бэкенд, здесь — так же: следующий по виду и году, без пропусков.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

/** Сроки резолюций — из заглушки задач, чтобы совпадали с задачами */
function mockStore(today = todayInBishkek()) {
  const tasks = createMockTasks(today).department;
  return createMockDocuments(today, (title) => tasks.find((t) => t.title === title)?.due ?? null);
}

let store = mockStore();

/** Сброс заглушки (для тестов) */
export function resetDocumentsMock(today?: IsoDate) {
  store = mockStore(today);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ——— Номера ———

const prefixes: Record<DocKind, string> = { incoming: 'Вх.', outgoing: 'Исх.', order: 'Приказ' };

/** Регистрационный номер: «Вх. №2026-0884», «Приказ №58»; у черновика — null */
export function docNumber(doc: Pick<DocumentRecord, 'kind' | 'seq' | 'year'>): string | null {
  if (doc.seq === null) return null;
  const n =
    doc.kind === 'order' ? String(doc.seq) : `${doc.year}-${String(doc.seq).padStart(4, '0')}`;
  return `${prefixes[doc.kind]} №${n}`;
}

/** Как документ упоминается в Базе знаний: «Вх. №2026-0884 · Минюст» */
export function docRef(doc: DocumentRecord): string | null {
  const number = docNumber(doc);
  return number && `${number} · ${doc.party ?? 'НОК КР'}`;
}

/**
 * Следующий номер по виду и году. Аннулированные номера заняты — счёт идёт от наибольшего,
 * поэтому пропусков нет.
 */
export function nextSeq(docs: DocumentRecord[], kind: DocKind, year: number): number {
  return (
    docs
      .filter((d) => d.kind === kind && d.year === year && d.seq !== null)
      .reduce((max, d) => Math.max(max, d.seq as number), 0) + 1
  );
}

/** Входящие, ждущие резолюции, — счётчик в меню */
export const awaitingResolution = (docs: DocumentRecord[] = store) =>
  docs.filter((d) => d.kind === 'incoming' && d.status === 'registered').length;

// ——— Действия ———

const me = (): Person => Object.values(people).find((p) => p.id === currentUserId) ?? people.ad;
const now = () => new Date().toISOString();
let seq = 0;
const historyEntry = (kind: DocHistoryEntry['kind'], text = ''): DocHistoryEntry => ({
  id: `dh-new-${++seq}`,
  kind,
  at: now(),
  by: me(),
  text,
});

function find(id: string) {
  const doc = store.find((d) => d.id === id);
  if (!doc) throw new Error('not-found');
  return doc;
}

function assertStatus(doc: DocumentRecord, ...allowed: DocStatus[]) {
  if (!allowed.includes(doc.status)) throw new Error('wrong-status');
}

const journal = (action: Parameters<typeof addJournalEntry>[0]['action'], doc: DocumentRecord) =>
  addJournalEntry({
    author: me().short,
    action,
    details: `${docNumber(doc) ?? doc.title} · ${doc.title}`,
  });

export type IncomingInput = {
  title: string;
  party: string;
  senderRef: string;
  summary: string;
  attachments: string[];
};

/** Зарегистрировать входящий: номер выдаётся сразу */
export function registerIncoming(input: IncomingInput, today = todayInBishkek()): DocumentRecord {
  const year = Number(today.slice(0, 4));
  const doc: DocumentRecord = {
    id: `doc-incoming-${year}-new-${++seq}`,
    kind: 'incoming',
    status: 'registered',
    seq: nextSeq(store, 'incoming', year),
    year,
    date: today,
    title: input.title.trim(),
    party: input.party.trim(),
    senderRef: input.senderRef.trim() || null,
    summary: input.summary.trim(),
    attachments: input.attachments,
    author: me(),
    signer: null,
    resolution: null,
    annulment: null,
    history: [historyEntry('registered')],
  };
  store.push(doc);
  journal('documentRegistered', doc);
  return structuredClone(doc);
}

export type DraftInput = {
  kind: Exclude<DocKind, 'incoming'>;
  title: string;
  party: string | null;
  summary: string;
  attachments: string[];
};

/** Проект исходящего или приказа — без номера, пока не отправят или не подпишут */
export function createDraft(input: DraftInput, today = todayInBishkek()): DocumentRecord {
  const doc: DocumentRecord = {
    id: `doc-${input.kind}-draft-new-${++seq}`,
    kind: input.kind,
    status: 'draft',
    seq: null,
    year: Number(today.slice(0, 4)),
    date: today,
    title: input.title.trim(),
    party: input.kind === 'order' ? null : (input.party?.trim() ?? null),
    senderRef: null,
    summary: input.summary.trim(),
    attachments: input.attachments,
    author: me(),
    signer: null,
    resolution: null,
    annulment: null,
    history: [historyEntry('created')],
  };
  store.push(doc);
  return structuredClone(doc);
}

/** Отправить исходящий или подписать приказ: в этот момент выдаётся номер (глоссарий) */
export function issue(id: string, today = todayInBishkek()): DocumentRecord {
  const doc = find(id);
  assertStatus(doc, 'draft');
  const year = Number(today.slice(0, 4));
  doc.year = year;
  doc.seq = nextSeq(store, doc.kind, year);
  doc.date = today;
  doc.signer = me();
  doc.status = doc.kind === 'outgoing' ? 'sent' : 'signed';
  doc.history.unshift(historyEntry(doc.kind === 'outgoing' ? 'sent' : 'signed'));
  journal('documentSent', doc);
  return structuredClone(doc);
}

export type ResolutionInput = { text: string; assignee: Person; due: IsoDate };

/** Резолюция на входящем: создаётся задача исполнителю со сроком резолюции */
export async function resolve(id: string, input: ResolutionInput): Promise<DocumentRecord> {
  const doc = find(id);
  assertStatus(doc, 'registered');
  if (input.text.trim().length < 3) throw new Error('text-required');
  const number = docNumber(doc);
  const task = await createTask({
    title: doc.title,
    description: `${number} · ${doc.party}\n\n${input.text.trim()}`,
    assignee: input.assignee,
    due: input.due,
    project: null,
    priority: 'normal',
    attachments: doc.attachments.length,
  });
  doc.resolution = {
    text: input.text.trim(),
    author: me(),
    at: now(),
    assignee: input.assignee,
    due: input.due,
    taskTitle: task.title,
  };
  doc.status = 'inWork';
  doc.history.unshift(historyEntry('resolution', input.text.trim()));
  journal('documentResolved', doc);
  return structuredClone(doc);
}

/** Исполнено — входящий снят с контроля */
export function markDone(id: string): DocumentRecord {
  const doc = find(id);
  assertStatus(doc, 'inWork');
  doc.status = 'done';
  doc.history.unshift(historyEntry('done'));
  journal('documentDone', doc);
  return structuredClone(doc);
}

/** Аннулировать с причиной. Номер остаётся занятым, документ не удаляется */
export function annul(id: string, reason: string): DocumentRecord {
  const doc = find(id);
  if (doc.status === 'annulled') throw new Error('wrong-status');
  if (reason.trim().length < 5) throw new Error('reason-required');
  doc.status = 'annulled';
  doc.annulment = { reason: reason.trim(), by: me(), at: now() };
  doc.history.unshift(historyEntry('annulled', reason.trim()));
  journal('documentAnnulled', doc);
  return structuredClone(doc);
}

// ——— Хуки ———

export const documentsKey = ['documents'] as const;

/** Все документы, новые сверху: черновики, затем по дате и номеру */
export function fetchDocuments(): DocumentRecord[] {
  return structuredClone(
    [...store].sort(
      (a, b) =>
        Number(b.seq === null) - Number(a.seq === null) ||
        b.date.localeCompare(a.date) ||
        (b.seq ?? 0) - (a.seq ?? 0),
    ),
  );
}

export function useDocuments() {
  return useQuery({
    queryKey: [...documentsKey, 'list'],
    queryFn: async () => {
      await delay(100);
      return fetchDocuments();
    },
  });
}

export function useDocument(id: string | null) {
  return useQuery({
    enabled: id !== null,
    queryKey: [...documentsKey, 'detail', id],
    queryFn: async () => {
      await delay(60);
      const doc = store.find((d) => d.id === id);
      return doc ? structuredClone(doc) : null;
    },
  });
}

/** Документ по ссылке из Базы знаний («Вх. №2026-0884 · Минюст») */
export const findByRef = (ref: string) => store.find((d) => docRef(d) === ref)?.id ?? null;

export function useAwaitingResolution() {
  return useQuery({
    queryKey: [...documentsKey, 'awaiting'],
    queryFn: async () => awaitingResolution(),
  }).data;
}

function useDocMutation<V, R>(
  fn: (vars: V) => R | Promise<R>,
  successMessage?: FeedbackMeta['successMessage'],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => {
      await delay(80);
      return fn(vars);
    },
    meta: successMessage ? { successMessage } : undefined,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: documentsKey });
      client.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

/** Тост с номером документа: «Зарегистрирован Вх. №2026-0897» */
const withNumber = (key: string) => (doc: DocumentRecord) => ({
  key,
  params: { number: docNumber(doc) ?? '', title: doc.title },
});

export const useRegisterIncoming = () =>
  useDocMutation(
    (input: IncomingInput) => registerIncoming(input),
    withNumber('documents.registered'),
  );

export const useCreateDraft = () =>
  useDocMutation((input: DraftInput) => createDraft(input), withNumber('documents.draftCreated'));

export const useIssue = () =>
  useDocMutation((id: string) => issue(id), withNumber('documents.issued'));

export const useResolve = () =>
  useDocMutation(
    ({ id, ...input }: ResolutionInput & { id: string }) => resolve(id, input),
    'documents.resolved',
  );

export const useMarkDone = () =>
  useDocMutation((id: string) => markDone(id), 'documents.doneToast');

export const useAnnul = () =>
  useDocMutation(
    ({ id, reason }: { id: string; reason: string }) => annul(id, reason),
    'documents.annulledToast',
  );
