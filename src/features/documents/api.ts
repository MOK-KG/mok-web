import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCan } from '@/features/auth';
import { type ApiPerson, tasksKey, toPerson } from '@/features/tasks/api';
import type { Person } from '@/features/tasks/types';
import { api } from '@/shared/api/client';
import type { FeedbackMeta } from '@/shared/api/feedback';
import type { IsoDate } from '@/shared/lib/workDays';
import { fillTemplate, type Letter } from './letter';
import type {
  DocAttachment,
  DocCategory,
  DocHistoryEntry,
  DocKind,
  DocumentRecord,
  Resolution,
} from './types';

/**
 * Данные делопроизводства — API бэкенда (mok-backend, apps/documents, /api/documents/*).
 * Номера выдаёт бэкенд: следующий по виду и году, аннулированный номер остаётся занятым.
 * Права проверяет бэкенд (403), неверный статус — 409 document_status.
 * Журнал действий по документам пишет бэкенд.
 *
 * В тестах вместо бэкенда — подставной сервер testing/server.ts на данных mock.ts.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

// --- Формат бэкенда ---------------------------------------------------------------------------

type ApiAttachment = { id: string; name: string; size: number | null; mimeType?: string };

export type ApiDocument = Omit<
  DocumentRecord,
  'author' | 'signer' | 'resolution' | 'annulment' | 'history' | 'attachments'
> & {
  number?: string | null;
  author: ApiPerson;
  signer: ApiPerson | null;
  attachments: ApiAttachment[];
  resolution:
    | (Omit<Resolution, 'author' | 'assignee'> & { author: ApiPerson; assignee: ApiPerson })
    | null;
  annulment: { reason: string; by: ApiPerson; at: string } | null;
  /** Только в карточке; в списке истории нет */
  history?: {
    id: string;
    kind: DocHistoryEntry['kind'];
    at: string;
    by: ApiPerson | null;
    text: string;
  }[];
};

export function toDocument(d: ApiDocument): DocumentRecord {
  return {
    id: d.id,
    kind: d.kind,
    status: d.status,
    seq: d.seq,
    year: d.year,
    date: d.date,
    title: d.title,
    party: d.party,
    senderRef: d.senderRef,
    summary: d.summary,
    attachments: d.attachments.map(
      (a): DocAttachment => ({ id: String(a.id), name: a.name, size: a.size }),
    ),
    author: toPerson(d.author),
    signer: d.signer ? toPerson(d.signer) : null,
    resolution: d.resolution && {
      ...d.resolution,
      author: toPerson(d.resolution.author),
      assignee: toPerson(d.resolution.assignee),
    },
    annulment: d.annulment && { ...d.annulment, by: toPerson(d.annulment.by) },
    history: (d.history ?? []).map((h) => ({ ...h, id: String(h.id), by: toPerson(h.by) })),
    category: d.category,
    replyDue: d.replyDue,
    replyTo: d.replyTo,
    delivery: d.delivery,
    letter: d.letter,
    fingerprint: d.fingerprint,
  };
}

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
 * Следующий номер по виду и году (так считает бэкенд). Аннулированные номера заняты — счёт идёт
 * от наибольшего, поэтому пропусков нет.
 */
export function nextSeq(docs: DocumentRecord[], kind: DocKind, year: number): number {
  return (
    docs
      .filter((d) => d.kind === kind && d.year === year && d.seq !== null)
      .reduce((max, d) => Math.max(max, d.seq as number), 0) + 1
  );
}

/** Входящие, ждущие резолюции */
export const awaitingResolution = (docs: DocumentRecord[]) =>
  docs.filter((d) => d.kind === 'incoming' && d.status === 'registered').length;

/** Документ по ссылке из Базы знаний («Вх. №2026-0884 · Минюст») */
export const findByRef = (ref: string, docs: DocumentRecord[]) =>
  docs.find((d) => docRef(d) === ref)?.id ?? null;

/** Скачать вложение документа */
export const attachmentUrl = (id: string) => api.url(`/documents/attachments/${id}/download`);

// ——— Запросы ———

/** Все документы, новые сверху: черновики, затем по дате и номеру. Без истории */
export async function fetchDocuments(): Promise<DocumentRecord[]> {
  return (await api.get<ApiDocument[]>('/documents/items')).map(toDocument);
}

export async function fetchDocument(id: string): Promise<DocumentRecord> {
  return toDocument(await api.get<ApiDocument>(`/documents/items/${id}`));
}

/** Файлы загружаются после создания документа; в ответе — документ с ними */
async function upload(doc: ApiDocument, files: File[] | undefined): Promise<DocumentRecord> {
  if (!files?.length) return toDocument(doc);
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    await api.post(`/documents/items/${doc.id}/attachments`, form);
  }
  return fetchDocument(doc.id);
}

export type IncomingInput = {
  title: string;
  party: string;
  senderRef: string;
  summary: string;
  /** Файлы — загружаются после регистрации */
  files?: File[];
  category: DocCategory;
  /** Срок ответа; undefined — по категории, null — ответ не нужен */
  replyDue?: IsoDate | null;
};

/** Зарегистрировать входящий: номер выдаётся сразу */
export async function registerIncoming(input: IncomingInput): Promise<DocumentRecord> {
  const { files, replyDue, ...rest } = input;
  const doc = await api.post<ApiDocument>('/documents/items/incoming', {
    ...rest,
    ...(replyDue === undefined ? {} : { replyDue }),
  });
  return upload(doc, files);
}

export type DraftInput = {
  kind: Exclude<DocKind, 'incoming'>;
  title: string;
  party: string | null;
  summary: string;
  files?: File[];
  /** Язык и шаблон письма; по умолчанию — русский, стандартный бланк */
  letter?: Letter;
  /** В ответ на входящий (ID) */
  replyTo?: string | null;
  /** Почта адресата; пусто — не по почте */
  email?: string;
};

/** Проект исходящего или приказа — без номера, пока не отправят или не подпишут */
export async function createDraft(input: DraftInput): Promise<DocumentRecord> {
  const letter =
    input.kind === 'outgoing'
      ? (input.letter ?? {
          lang: 'ru',
          templateId: 'standard',
          addressee: input.party?.trim() ?? '',
          body: fillTemplate('standard', 'ru'),
          email: input.email?.trim() ?? '',
        })
      : null;
  const doc = await api.post<ApiDocument>('/documents/items/drafts', {
    kind: input.kind,
    title: input.title,
    party: input.party ?? '',
    summary: input.summary,
    letter,
    replyTo: input.replyTo ?? null,
    email: input.email ?? '',
  });
  return upload(doc, input.files);
}

const action = async (id: string, name: string, body: object = {}) =>
  toDocument(await api.post<ApiDocument>(`/documents/items/${id}/${name}`, body));

/** Отправить исходящий или подписать приказ: в этот момент выдаётся номер (глоссарий) */
export const issue = (id: string) => action(id, 'issue');

/** Правка письма — только в проекте; отправленное письмо неизменяемо */
export const updateLetter = (id: string, letter: Letter, title?: string) =>
  action(id, 'letter', { letter, title: title ?? '' });

/**
 * Повторная отправка после недоставки — на исправленный адрес. Номер тот же: письмо уже
 * зарегистрировано, текст и отпечаток не меняются.
 */
export const resend = (id: string, email: string) => action(id, 'resend', { email });

export type ResolutionInput = { text: string; assignee: Person; due: IsoDate };

/** Резолюция на входящем: бэкенд создаёт задачу исполнителю со сроком резолюции */
export const resolve = (id: string, input: ResolutionInput) =>
  action(id, 'resolve', { text: input.text, assigneeId: input.assignee.id, due: input.due });

/** Исполнено — входящий снят с контроля */
export const markDone = (id: string) => action(id, 'done');

/** Аннулировать с причиной. Номер остаётся занятым, документ не удаляется */
export const annul = (id: string, reason: string) => action(id, 'annul', { reason });

// ——— Хуки ———

export const documentsKey = ['documents'] as const;

export function useDocuments(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...documentsKey, 'list'],
    queryFn: fetchDocuments,
  });
}

export function useDocument(id: string | null) {
  return useQuery({
    enabled: id !== null,
    queryKey: [...documentsKey, 'detail', id],
    queryFn: () => fetchDocument(id as string),
    retry: false,
  });
}

/** ID документа по ссылке из Базы знаний; null — нет такого или нет права documents.view */
export function useDocumentIdByRef(ref: string | null) {
  const { can } = useCan();
  const docs = useDocuments(ref !== null && can('documents.view')).data;
  return ref && docs ? findByRef(ref, docs) : null;
}

/** Входящие, ждущие резолюции, — счётчик в меню (только с правом documents.view) */
export function useAwaitingResolution() {
  const { can } = useCan();
  return useQuery({
    enabled: can('documents.view'),
    queryKey: [...documentsKey, 'awaiting'],
    queryFn: async () => (await api.get<{ count: number }>('/documents/awaiting')).count,
  }).data;
}

function useDocMutation<V>(
  fn: (vars: V) => Promise<DocumentRecord>,
  successMessage?: FeedbackMeta['successMessage'],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta: successMessage ? { successMessage } : undefined,
    onSettled: () => {
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
  useDocMutation(registerIncoming, withNumber('documents.registered'));

export const useCreateDraft = () =>
  useDocMutation(createDraft, withNumber('documents.draftCreated'));

export const useIssue = () => useDocMutation(issue, withNumber('documents.issued'));

export const useResolve = () =>
  useDocMutation(
    ({ id, ...input }: ResolutionInput & { id: string }) => resolve(id, input),
    'documents.resolved',
  );

export const useUpdateLetter = () =>
  useDocMutation(
    ({ id, letter, title }: { id: string; letter: Letter; title?: string }) =>
      updateLetter(id, letter, title),
    'documents.letterSaved',
  );

export const useResend = () =>
  useDocMutation(
    ({ id, email }: { id: string; email: string }) => resend(id, email),
    (doc: DocumentRecord) => ({
      key:
        doc.delivery?.status === 'bounced' ? 'documents.log.bouncedAgain' : 'documents.log.resent',
      params: { email: doc.delivery?.email ?? '' },
    }),
  );

export const useMarkDone = () => useDocMutation(markDone, 'documents.doneToast');

export const useAnnul = () =>
  useDocMutation(
    ({ id, reason }: { id: string; reason: string }) => annul(id, reason),
    'documents.annulledToast',
  );
