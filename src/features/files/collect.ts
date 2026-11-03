import type { ChatFile } from '../chat/api';
import { docNumber } from '../documents/api';
import type { DocKind, DocumentRecord } from '../documents/types';
import type { KbFile } from '../knowledge-base/api';

/**
 * Раздел «Файлы»: все вложения из разделов в одном списке — документы, статьи Базы знаний,
 * переписки. Своего хранилища у раздела нет: файл живёт там, куда его прикрепили,
 * и виден только тем, кому открыт этот раздел, статья или переписка.
 * У задач пока хранится только число вложений, без файлов, — они появятся с бэкендом.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type FileSource = 'documents' | 'knowledge' | 'chat';

export const fileSources: FileSource[] = ['documents', 'knowledge', 'chat'];

export type FileType = 'pdf' | 'doc' | 'sheet' | 'image' | 'other';

export const fileTypes: FileType[] = ['pdf', 'doc', 'sheet', 'image', 'other'];

export type FileTarget =
  | { kind: 'document'; id: string; docKind: DocKind }
  | { kind: 'article'; id: string }
  | { kind: 'chat'; chatId: string };

export type FileItem = {
  id: string;
  /** Имя без расширения */
  name: string;
  ext: string;
  size: number | null;
  type: FileType;
  source: FileSource;
  /** Где лежит: номер документа, статья, переписка */
  place: string;
  target: FileTarget;
  /** Кто прикрепил (короткое имя); null — неизвестно */
  addedBy: string | null;
  /** Когда — ISO-время */
  at: string;
};

const typeByExt: Record<string, FileType> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  rtf: 'doc',
  odt: 'doc',
  txt: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  ods: 'sheet',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  heic: 'image',
};

export const fileTypeOf = (ext: string): FileType => typeByExt[ext.toLowerCase()] ?? 'other';

/** «запрос_минюст.pdf» → имя «запрос_минюст», расширение «pdf» */
export function splitName(full: string): { name: string; ext: string } {
  const dot = full.lastIndexOf('.');
  return dot > 0
    ? { name: full.slice(0, dot), ext: full.slice(dot + 1).toLowerCase() }
    : { name: full, ext: '' };
}

/** Дата без времени — полдень по Бишкеку, чтобы сортировалась вместе с ISO-временем */
const isoAt = (date: string) => (date.length === 10 ? `${date}T12:00:00+06:00` : date);

export type FileSources = {
  documents?: DocumentRecord[];
  knowledge?: KbFile[];
  chat?: ChatFile[];
  /** Короткое имя участника чата по ID */
  memberName?: (id: string) => string | null;
};

/** Собрать файлы из разделов, новые сверху. Не переданный раздел — не показывается */
export function collectFiles({
  documents = [],
  knowledge = [],
  chat = [],
  memberName = () => null,
}: FileSources): FileItem[] {
  const items: FileItem[] = [
    ...documents.flatMap((doc) =>
      doc.attachments.map((full, i): FileItem => {
        const { name, ext } = splitName(full);
        return {
          id: `doc:${doc.id}:${i}`,
          name,
          ext,
          size: null,
          type: fileTypeOf(ext),
          source: 'documents',
          place: `${docNumber(doc) ?? doc.title}${docNumber(doc) ? ` · ${doc.title}` : ''}`,
          target: { kind: 'document', id: doc.id, docKind: doc.kind },
          addedBy: doc.author.short,
          at: isoAt(doc.date),
        };
      }),
    ),
    ...knowledge.map(
      (f): FileItem => ({
        id: `kb:${f.articleId}:${f.attachment.id}`,
        name: f.attachment.name,
        ext: f.attachment.ext,
        size: f.attachment.size,
        type: fileTypeOf(f.attachment.ext),
        source: 'knowledge',
        place: f.articleTitle,
        target: { kind: 'article', id: f.articleId },
        addedBy: f.author.short,
        at: isoAt(f.updatedAt),
      }),
    ),
    ...chat.map(
      (f): FileItem => ({
        id: `chat:${f.messageId}`,
        name: f.name,
        ext: f.ext,
        size: null,
        type: fileTypeOf(f.ext),
        source: 'chat',
        place: f.chatTitle,
        target: { kind: 'chat', chatId: f.chatId },
        addedBy: f.authorId ? memberName(f.authorId) : null,
        at: f.at,
      }),
    ),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at) || a.name.localeCompare(b.name, 'ru'));
}

export type FileFilters = { source: FileSource | null; type: FileType | null; query: string };

export function filterFiles(items: FileItem[], { source, type, query }: FileFilters) {
  const needle = query.trim().toLocaleLowerCase('ru');
  return items.filter(
    (f) =>
      (!source || f.source === source) &&
      (!type || f.type === type) &&
      (!needle ||
        [`${f.name}.${f.ext}`, f.place, f.addedBy].some((v) =>
          v?.toLocaleLowerCase('ru').includes(needle),
        )),
  );
}

/** Размер для подписи: «48 КБ»; null — неизвестен (файлы из заглушки) */
export function formatSize(bytes: number | null, units: { kb: string; mb: string }) {
  if (bytes === null) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ${units.kb}`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.0', '')} ${units.mb}`;
}
