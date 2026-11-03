/**
 * Журнал действий (заглушка до бэкенда). Записи только добавляются: изменить или удалить
 * запись нельзя никому, включая администратора и Генерального секретаря (ТЗ, раздел 07).
 * Записи связаны цепочкой хешей: у каждой — хеш предыдущей; правка или удаление любой
 * записи ломает проверку целостности (приёмка 11.4).
 *
 * Хеш в заглушке — FNV-1a, только чтобы показать цепочку; на бэкенде — криптографический
 * (SHA-256) и проверка на сервере.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type JournalAction =
  | 'accessDenied'
  | 'mailRejected'
  | 'mailAccepted'
  | 'roleChanged'
  | 'userInvited'
  | 'userDeactivated'
  | 'documentRegistered'
  | 'documentSent'
  | 'documentResolved'
  | 'documentDone'
  | 'documentAnnulled'
  | 'journalExported';

/** Группы действий — для фильтра на экране журнала */
export const journalGroups = {
  access: ['accessDenied'],
  staff: ['roleChanged', 'userInvited', 'userDeactivated'],
  tasks: ['mailRejected', 'mailAccepted'],
  documents: [
    'documentRegistered',
    'documentSent',
    'documentResolved',
    'documentDone',
    'documentAnnulled',
  ],
  journal: ['journalExported'],
} as const satisfies Record<string, readonly JournalAction[]>;

export type JournalGroup = keyof typeof journalGroups;

export const groupOf = (action: JournalAction): JournalGroup =>
  (Object.keys(journalGroups) as JournalGroup[]).find((g) =>
    (journalGroups[g] as readonly JournalAction[]).includes(action),
  ) ?? 'access';

export type JournalEntry = {
  id: string;
  /** ISO-время */
  at: string;
  /** Кто: короткое имя */
  author: string;
  action: JournalAction;
  details: string;
  /** Основание — для выгрузки и других действий, где его требуют */
  reason?: string;
  /** Хеш предыдущей записи; у первой — нули */
  prevHash: string;
  hash: string;
};

const GENESIS = '00000000';

/** FNV-1a 32 бита → 8 hex-символов */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const hashOf = (e: Omit<JournalEntry, 'hash' | 'id'>) =>
  fnv([e.prevHash, e.at, e.author, e.action, e.details, e.reason ?? ''].join('|'));

let journal: JournalEntry[] = [];
let seq = 0;

export type NewJournalEntry = Omit<JournalEntry, 'id' | 'at' | 'prevHash' | 'hash'> & {
  at?: string;
};

/** Добавить запись в конец цепочки */
export function addJournalEntry(entry: NewJournalEntry): JournalEntry {
  const prevHash = journal.at(-1)?.hash ?? GENESIS;
  const base = { ...entry, at: entry.at ?? new Date().toISOString(), prevHash };
  const record: JournalEntry = { id: `j-${++seq}`, ...base, hash: hashOf(base) };
  journal.push(record);
  return { ...record };
}

/** Все записи от старых к новым — копии: изменить журнал через них нельзя */
export const journalEntries = (): readonly JournalEntry[] => journal.map((e) => ({ ...e }));

/** Проверка целостности: хеши совпадают и каждая запись ссылается на предыдущую */
export function verifyJournal(entries: readonly JournalEntry[] = journal) {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const prev = i === 0 ? GENESIS : entries[i - 1].hash;
    const { id: _id, hash: _hash, ...rest } = e;
    if (e.prevHash !== prev || e.hash !== hashOf(rest)) {
      return { ok: false as const, checked: entries.length, brokenAt: e.id };
    }
  }
  return { ok: true as const, checked: entries.length, brokenAt: null };
}

/** Записи журнала, с которых начинается заглушка: время — относительно «сейчас» */
function seed(now: number) {
  const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  const entries: NewJournalEntry[] = [
    {
      at: ago(24 * 60),
      author: 'А. Турсунов',
      action: 'userInvited',
      details: 'Нурлан Бакиров · n.bakirov@olympic.kg',
    },
    {
      at: ago(24 * 45),
      author: 'А. Турсунов',
      action: 'roleChanged',
      details: 'Ю. Ведерникова: R8 → R5',
    },
    {
      at: ago(26),
      author: 'К. Асанов',
      action: 'documentRegistered',
      details: 'Вх. №2026-0896 · О предоставлении спортивных объектов',
    },
    {
      at: ago(5),
      author: 'Г. Каримова',
      action: 'accessDenied',
      details: '/access · staff.view',
    },
  ];
  for (const e of entries) addJournalEntry(e);
}

/** Сброс заглушки; в тестах — пустой журнал */
export function resetJournal({ withSeed = false, now = Date.now() } = {}) {
  journal = [];
  seq = 0;
  if (withSeed) seed(now);
}

resetJournal({ withSeed: true });
