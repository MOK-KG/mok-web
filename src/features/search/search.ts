import type { ChatMessage } from '../chat/types';
import { docNumber } from '../documents/api';
import type { DocumentRecord } from '../documents/types';
import type { FileItem, FileTarget } from '../files/collect';
import { queryStems } from '../knowledge-base/search';
import type { KbArticleSummary } from '../knowledge-base/types';
import type { Task } from '../tasks/types';

/**
 * Поиск по системе (экран S-09). Ищет только в том, что пользователю уже выдано с его
 * правами: чужого не находит и не считает (приёмка 11.3). Нет права на раздел — его данные
 * не запрашиваются вовсе. С бэкендом — один запрос, ограничение в запросе к базе.
 *
 * Слова — без окончаний, как в Базе знаний: «перевода» находит «перевод».
 * Подходит запись, в которой есть все слова запроса.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type SearchKind = 'tasks' | 'documents' | 'knowledge' | 'files' | 'chat';

export const searchKinds: SearchKind[] = ['tasks', 'documents', 'knowledge', 'files', 'chat'];

export type SearchTarget =
  | { kind: 'task'; id: string }
  | { kind: 'document'; id: string; docKind: DocumentRecord['kind'] }
  | { kind: 'article'; id: string }
  | FileTarget;

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  /** Номер, раздел, корреспондент — строка под заголовком */
  subtitle: string;
  /** Отрывок с найденным словом; null — совпало в заголовке */
  snippet: string | null;
  target: SearchTarget;
};

export type SearchSources = {
  tasks?: Task[];
  documents?: DocumentRecord[];
  articles?: KbArticleSummary[];
  /** ID статей, где запрос нашёлся в тексте (поиск Базы знаний по открытым разделам) */
  articleIds?: string[];
  files?: FileItem[];
  messages?: { message: ChatMessage; chatTitle: string; author: string | null }[];
};

export type SearchResults = Record<SearchKind, SearchHit[]>;

const normalize = (text: string) => text.toLowerCase().replaceAll('ё', 'е');

/** Есть ли в тексте все слова запроса */
export const matchesStems = (stems: string[], ...fields: (string | null | undefined)[]) => {
  const text = normalize(fields.filter(Boolean).join(' '));
  return stems.length > 0 && stems.every((s) => text.includes(s));
};

/** Отрывок вокруг первого найденного слова: «…сверить с юристами перевод устава…» */
export function snippetOf(text: string, stems: string[], radius = 48): string | null {
  const norm = normalize(text);
  const at = stems.map((s) => norm.indexOf(s)).filter((i) => i >= 0);
  if (at.length === 0) return null;
  const start = Math.max(0, Math.min(...at) - radius);
  const end = Math.min(text.length, Math.min(...at) + radius * 2);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/** Части текста с пометкой найденного — для подсветки */
export function highlight(text: string, stems: string[]): { text: string; hit: boolean }[] {
  if (stems.length === 0) return [{ text, hit: false }];
  const norm = normalize(text);
  const marks = new Array<boolean>(text.length).fill(false);
  for (const s of stems) {
    for (let i = norm.indexOf(s); i >= 0; i = norm.indexOf(s, i + 1)) {
      // Основа слова + окончание до конца слова: «Миню» → «Минюст»
      let end = i + s.length;
      while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) end++;
      for (let j = i; j < end; j++) marks[j] = true;
    }
  }
  const parts: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts.at(-1);
    if (last && last.hit === marks[i]) last.text += text[i];
    else parts.push({ text: text[i], hit: marks[i] });
  }
  return parts;
}

/** Слова запроса; короче двух букв — не ищем, чтобы не находить всё подряд */
export const searchStems = (query: string) => queryStems(query).filter((s) => s.length >= 2);

export function searchAll(query: string, sources: SearchSources): SearchResults {
  const stems = searchStems(query);
  const empty: SearchResults = { tasks: [], documents: [], knowledge: [], files: [], chat: [] };
  if (stems.length === 0) return empty;

  const tasks = (sources.tasks ?? [])
    .filter((t) => matchesStems(stems, t.title, t.code, t.project?.name, t.assignee?.name))
    .map(
      (t): SearchHit => ({
        id: `task:${t.id}`,
        kind: 'tasks',
        title: t.title,
        subtitle: [t.code, t.project?.name, t.assignee?.short].filter(Boolean).join(' · '),
        snippet: null,
        target: { kind: 'task', id: t.id },
      }),
    );

  const documents = (sources.documents ?? [])
    .filter((d) => matchesStems(stems, docNumber(d), d.title, d.party, d.senderRef, d.summary))
    .map(
      (d): SearchHit => ({
        id: `doc:${d.id}`,
        kind: 'documents',
        title: d.title,
        subtitle: [docNumber(d), d.party].filter(Boolean).join(' · '),
        snippet: matchesStems(stems, docNumber(d), d.title, d.party)
          ? null
          : snippetOf(d.summary, stems),
        target: { kind: 'document', id: d.id, docKind: d.kind },
      }),
    );

  const inText = new Set(sources.articleIds ?? []);
  const knowledge = (sources.articles ?? [])
    .filter((a) => inText.has(a.id) || matchesStems(stems, a.title, a.summary))
    .map(
      (a): SearchHit => ({
        id: `kb:${a.id}`,
        kind: 'knowledge',
        title: a.title,
        subtitle: a.author.short,
        snippet: snippetOf(a.summary, stems),
        target: { kind: 'article', id: a.id },
      }),
    );

  const files = (sources.files ?? [])
    .filter((f) => matchesStems(stems, `${f.name}.${f.ext}`, f.place))
    .map(
      (f): SearchHit => ({
        id: `file:${f.id}`,
        kind: 'files',
        title: f.ext ? `${f.name}.${f.ext}` : f.name,
        subtitle: f.place,
        snippet: null,
        target: f.target,
      }),
    );

  const chat = (sources.messages ?? [])
    .filter(({ message: m }) => m.kind === 'text' && matchesStems(stems, m.text, m.file?.name))
    .map(
      ({ message: m, chatTitle, author }): SearchHit => ({
        id: `msg:${m.id}`,
        kind: 'chat',
        title: chatTitle,
        subtitle: author ?? '',
        snippet: snippetOf(m.text || m.file?.name || '', stems) ?? m.text,
        target: { kind: 'chat', chatId: m.chatId },
      }),
    )
    .reverse();

  return { tasks, documents, knowledge, files, chat };
}
