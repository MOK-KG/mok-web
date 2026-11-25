import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Журнал действий — API бэкенда (mok-backend, apps/journal, /api/journal/*). Записи только
 * добавляются: изменить или удалить запись нельзя никому, включая администратора и
 * Генерального секретаря (ТЗ, раздел 07). Записи связаны цепочкой SHA-256: у каждой — хеш
 * предыдущей; проверка целостности — на сервере (приёмка 11.4).
 *
 * Действия, которые делает бэкенд (письма → задачи, выгрузка журнала), сервер пишет сам.
 * Разделы, которые ещё на заглушках, пишут через addJournalEntry: запрос POST уходит на сервер
 * (автор — из сессии), а запись сразу попадает в локальный кэш — его читает journalEntries().
 *
 * В тестах вместо бэкенда — подставной сервер testing/server.ts.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type JournalAction =
  | 'accessDenied'
  | 'mailRejected'
  | 'mailAccepted'
  | 'mailLinked'
  | 'roleChanged'
  | 'userInvited'
  | 'userDeactivated'
  | 'userReactivated'
  | 'absenceCreated'
  | 'absenceCancelled'
  | 'absenceUpdated'
  | 'sessionEnded'
  | 'rolePermissionsChanged'
  | 'taskCreated'
  | 'taskAssigned'
  | 'taskMoved'
  | 'taskDueChanged'
  | 'taskArchived'
  | 'taskRestored'
  | 'documentRegistered'
  | 'documentSent'
  | 'documentResolved'
  | 'documentDone'
  | 'documentAnnulled'
  | 'documentBounced'
  | 'journalExported'
  | 'sessionEnded'
  | 'mailboxConnected'
  | 'mailboxDisconnected'
  | 'calendarConnected'
  | 'calendarDisconnected'
  | 'driveConnected'
  | 'driveDisconnected'
  | 'assistantAction'
  | 'rolePermissionsChanged';

/** Группы действий — для фильтра на экране журнала */
export const journalGroups = {
  access: ['accessDenied'],
  staff: [
    'roleChanged',
    'userInvited',
    'userDeactivated',
    'userReactivated',
    'sessionEnded',
    'rolePermissionsChanged',
    'absenceCreated',
    'absenceCancelled',
    'absenceUpdated',
  ],
  tasks: [
    'mailRejected',
    'mailAccepted',
    'mailboxConnected',
    'mailboxDisconnected',
    'mailLinked',
    'taskCreated',
    'taskAssigned',
    'taskMoved',
    'taskDueChanged',
    'taskArchived',
    'taskRestored',
    'calendarConnected',
    'calendarDisconnected',
    'assistantAction',
  ],
  documents: [
    'documentRegistered',
    'documentSent',
    'documentResolved',
    'documentDone',
    'documentAnnulled',
    'documentBounced',
    'driveConnected',
    'driveDisconnected',
  ],
  journal: ['journalExported'],
} as const satisfies Record<string, readonly JournalAction[]>;

export type JournalGroup = keyof typeof journalGroups;

export const journalActions = Object.values(journalGroups).flat() as JournalAction[];

export const groupOf = (action: JournalAction): JournalGroup =>
  (Object.keys(journalGroups) as JournalGroup[]).find((g) =>
    (journalGroups[g] as readonly JournalAction[]).includes(action),
  ) ?? 'access';

export type JournalEntry = {
  id: string;
  /** ISO-время */
  at: string;
  /** Кто: короткое имя (снимок на момент записи) */
  author: string;
  /** ID сотрудника; null — система или агент почты */
  authorId?: string | null;
  action: JournalAction;
  details: string;
  /** Основание — для выгрузки и других действий, где его требуют */
  reason?: string;
  /** Ссылка на объект, например task:ЗД-2026-0001 */
  target?: string;
  /** Хеш предыдущей записи; у первой — нули. У записи, ещё не сохранённой сервером, — пусто */
  prevHash: string;
  hash: string;
};

// --- Формат бэкенда ---------------------------------------------------------------------------

export type ApiJournalEntry = {
  id: string;
  at: string;
  author: string;
  authorId: string | null;
  action: JournalAction;
  details: string;
  reason: string;
  target: string;
  prevHash: string;
  hash: string;
};

export type ApiJournalPage = {
  items: ApiJournalEntry[];
  /** Записей по всем фильтрам */
  total: number;
  /** Записей в группах — по тем же фильтрам, кроме группы */
  counts: Record<JournalGroup, number>;
  hasMore: boolean;
  /** Записей в журнале всего */
  size: number;
};

export type JournalIntegrity = { ok: boolean; checked: number; brokenAt: string | null };

export const toJournalEntry = (e: ApiJournalEntry): JournalEntry => ({
  id: e.id,
  at: e.at,
  author: e.author,
  authorId: e.authorId,
  action: e.action,
  details: e.details,
  ...(e.reason ? { reason: e.reason } : {}),
  ...(e.target ? { target: e.target } : {}),
  prevHash: e.prevHash,
  hash: e.hash,
});

// --- Локальный кэш ----------------------------------------------------------------------------

/** Последние известные записи от старых к новым: загруженные и отправленные отсюда */
let cache: JournalEntry[] = [];
let pending: Promise<unknown>[] = [];
let localSeq = 0;
const CACHE_LIMIT = 500;

const isLocal = (e: JournalEntry) => e.id.startsWith('local-');

function remember(entries: readonly JournalEntry[]) {
  const byId = new Map(cache.map((e) => [e.id, e]));
  for (const e of entries) byId.set(e.id, e);
  const all = [...byId.values()];
  const saved = all.filter((e) => !isLocal(e)).sort((a, b) => Number(a.id) - Number(b.id));
  cache = [...saved, ...all.filter(isLocal)].slice(-CACHE_LIMIT);
}

export type NewJournalEntry = Omit<
  JournalEntry,
  'id' | 'at' | 'prevHash' | 'hash' | 'authorId' | 'target'
> & {
  at?: string;
  target?: string;
};

/**
 * ВРЕМЕННО, для разделов на заглушках: записать действие. Запись сразу видна в journalEntries(),
 * на сервер уходит POST /journal/entries (автор — из сессии, author здесь — только для показа
 * до ответа). Ответ сервера заменяет запись в кэше; отказ сервера — убирает её.
 */
export function addJournalEntry(entry: NewJournalEntry): JournalEntry {
  const local: JournalEntry = {
    ...entry,
    id: `local-${++localSeq}`,
    at: entry.at ?? new Date().toISOString(),
    prevHash: '',
    hash: '',
  };
  cache.push(local);
  const request = api
    .post<ApiJournalEntry>('/journal/entries', {
      action: entry.action,
      details: entry.details,
      reason: entry.reason ?? '',
      target: entry.target ?? '',
    })
    .then((saved) => {
      cache = cache.filter((e) => e !== local);
      remember([toJournalEntry(saved)]);
    })
    .catch(() => {
      cache = cache.filter((e) => e !== local);
    })
    .finally(() => {
      pending = pending.filter((p) => p !== request);
    });
  pending.push(request);
  return { ...local };
}

/** Дождаться ответов на отправленные записи (в тестах) */
export const journalSettled = () => Promise.all(pending).then(() => undefined);

/** Известные записи от старых к новым — копии: изменить журнал через них нельзя */
export const journalEntries = (): readonly JournalEntry[] => cache.map((e) => ({ ...e }));

/** Сброс кэша между тестами */
export function resetJournal() {
  cache = [];
  pending = [];
  localSeq = 0;
}

// --- Запросы ----------------------------------------------------------------------------------

export const journalKey = ['journal'] as const;

export type JournalFilters = {
  group?: JournalGroup | null;
  action?: JournalAction | null;
  /** ID сотрудника */
  author?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  q?: string;
  /** Действия, чьё название на языке интерфейса совпало с q (переводы — во фронте) */
  qActions?: readonly JournalAction[];
  limit?: number;
  before?: string | null;
};

export type JournalPage = Omit<ApiJournalPage, 'items'> & { items: JournalEntry[] };

/** Записи от новых к старым по фильтрам */
export async function fetchJournal(filters: JournalFilters = {}): Promise<JournalPage> {
  const page = await api.get<ApiJournalPage>('/journal/entries', {
    query: {
      group: filters.group,
      action: filters.action,
      author: filters.author,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      q: filters.q?.trim() || undefined,
      qActions: filters.qActions?.length ? filters.qActions.join(',') : undefined,
      limit: filters.limit,
      before: filters.before,
    },
  });
  const items = page.items.map(toJournalEntry);
  remember(items);
  return { ...page, items };
}

export const verifyJournal = () => api.get<JournalIntegrity>('/journal/verify');

/** Выгрузка CSV (право journal.export); сервер сам пишет запись о выгрузке с основанием */
export const exportJournal = (reason: string) =>
  api.get<string>('/journal/export', { query: { reason: reason.trim() } });

export function useJournal(filters: JournalFilters) {
  return useQuery({
    queryKey: [...journalKey, 'entries', filters],
    queryFn: () => fetchJournal(filters),
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
  });
}

export function useJournalIntegrity() {
  return useQuery({
    queryKey: [...journalKey, 'verify'],
    queryFn: verifyJournal,
    refetchOnMount: 'always',
  });
}
