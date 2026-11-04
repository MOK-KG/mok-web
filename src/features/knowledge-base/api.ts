import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { docRef, useDocuments } from '@/features/documents/api';
import type { Person } from '@/features/tasks/types';
import { ApiError, api } from '@/shared/api/client';
import type { RoleCode } from '@/shared/config/permissions';
import { type Tone, toneNames } from '@/shared/config/tokens';
import type { IsoDate } from '@/shared/lib/workDays';
import { blocksToMarkdown, markdownToBlocks } from './markdown';
import { queryStems } from './search';
import type {
  KbArticle,
  KbArticleSummary,
  KbAttachment,
  KbBlock,
  KbRelatedDocument,
  KbRelatedTask,
  KbSection,
  KbVersion,
} from './types';

/**
 * Данные базы знаний — API бэкенда (mok-backend, apps/knowledge): разделы — папки верхнего
 * уровня, статьи — документы (ID статьи — её адрес), текст хранится в markdown и превращается
 * в блоки здесь (markdown.ts).
 *
 * Права проверяет бэкенд: статьи закрытых разделов не приходят ни в списке, ни в поиске,
 * а по прямой ссылке — ошибка 403.
 */

// --- Формат бэкенда ---------------------------------------------------------------------------

export type ApiPerson = { id: string; email: string; name: string };

type ApiSummary = Omit<KbArticleSummary, 'author' | 'reviewed' | 'sectionId'> & {
  sectionId: string | null;
  author: ApiPerson | null;
  reviewed: { date: IsoDate; by: ApiPerson | null } | null;
};

type ApiVersion = Omit<KbVersion, 'author' | 'body'> & { author: ApiPerson | null; body: string };

type ApiArticle = ApiSummary & {
  version: number;
  body: string;
  attachments: { id: string; filename: string; size: number }[];
  relatedTasks: KbRelatedTask[];
  relatedDocuments: KbRelatedDocument[];
  versions: ApiVersion[];
};

type ApiFile = {
  attachment: { id: string; filename: string; size: number };
  articleId: string;
  articleTitle: string;
  author: ApiPerson | null;
  updatedAt: IsoDate;
};

type ApiSearchHit = { document: { slug: string } };

// --- Преобразования ---------------------------------------------------------------------------

/** Цвет аватара — по ID сотрудника, одинаковый на всех экранах */
const toneOf = (id: string): Tone => {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return toneNames[hash % toneNames.length];
};

/** «Нурлан Бакиров» → «Н. Бакиров» */
const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
};

/** Автор неизвестен — статья из примеров или импорта, без сотрудника */
const nobody: Person = { id: 'system', name: '—', short: '—', tone: 'blue' };

export function toPerson(person: ApiPerson | null): Person {
  if (!person) return nobody;
  return {
    id: person.id,
    name: person.name,
    short: shortName(person.name),
    tone: toneOf(person.id),
  };
}

/** «Устав НОК КР.pdf» → { name: «Устав НОК КР», ext: «pdf» } */
const splitFilename = (filename: string) => {
  const dot = filename.lastIndexOf('.');
  return dot > 0
    ? { name: filename.slice(0, dot), ext: filename.slice(dot + 1).toLowerCase() }
    : { name: filename, ext: '' };
};

const toAttachment = (a: { id: string; filename: string; size: number }): KbAttachment => ({
  id: a.id,
  ...splitFilename(a.filename),
  size: a.size,
});

const toSummary = (a: ApiSummary): KbArticleSummary => ({
  id: a.id,
  sectionId: a.sectionId ?? '',
  title: a.title,
  summary: a.summary,
  author: toPerson(a.author),
  updatedAt: a.updatedAt,
  reviewed: a.reviewed && { date: a.reviewed.date, by: toPerson(a.reviewed.by) },
  tasksCount: a.tasksCount,
  documentsCount: a.documentsCount,
});

const toArticle = (a: ApiArticle): KbArticle => ({
  ...toSummary(a),
  version: a.version,
  body: markdownToBlocks(a.body),
  attachments: a.attachments.map(toAttachment),
  relatedTasks: a.relatedTasks,
  relatedDocuments: a.relatedDocuments,
  versions: a.versions.map((v) => ({
    ...v,
    author: toPerson(v.author),
    body: markdownToBlocks(v.body),
  })),
});

// --- Чтение -----------------------------------------------------------------------------------

export const knowledgeKey = ['knowledge'] as const;

/** Роли в ключе запроса: сменилась роль — списки перечитываются */
const useRoles = () => (useSession().data?.user.roles ?? []) as RoleCode[];

export type KnowledgeList = { sections: KbSection[]; articles: KbArticleSummary[] };

export async function fetchKnowledge(): Promise<KnowledgeList> {
  const data = await api.get<{ sections: KbSection[]; articles: ApiSummary[] }>(
    '/knowledge/overview',
  );
  return { sections: data.sections, articles: data.articles.map(toSummary) };
}

export function useKnowledge() {
  const roles = useRoles();
  return useQuery({ queryKey: [...knowledgeKey, 'list', roles], queryFn: fetchKnowledge });
}

export type KnowledgeSearch = { ids: string[] };

/** Сколько фрагментов просить у поиска: статьи из них — без повторов, в порядке совпадения */
const SEARCH_LIMIT = 50;

/**
 * Поиск по тексту статей и вложений — только в открытых разделах. Совпадения в закрытых
 * не возвращаются и не считаются даже числом (приёмка 11.3)
 */
export async function searchKnowledge(query: string): Promise<KnowledgeSearch> {
  const hits = await api.get<ApiSearchHit[]>('/knowledge/search', {
    query: { q: query.trim(), limit: SEARCH_LIMIT },
  });
  return { ids: [...new Set(hits.map((h) => h.document.slug))] };
}

export function useKnowledgeSearch(query: string) {
  const roles = useRoles();
  return useQuery({
    queryKey: [...knowledgeKey, 'search', query.trim(), roles],
    queryFn: () => searchKnowledge(query),
    enabled: queryStems(query).length > 0,
    placeholderData: keepPreviousData,
  });
}

export async function fetchArticle(id: string): Promise<KbArticle> {
  return toArticle(await api.get<ApiArticle>(`/knowledge/articles/${encodeURIComponent(id)}`));
}

export function useArticle(id: string, { enabled = true } = {}) {
  const roles = useRoles();
  return useQuery({
    enabled,
    queryKey: [...knowledgeKey, 'article', id, roles],
    queryFn: () => fetchArticle(id),
    // 403 и 404 не повторяем — ответ не изменится
    retry: (count, error) =>
      !(error instanceof ApiError && [403, 404].includes(error.status)) && count < 2,
  });
}

/** Вложение статьи для раздела «Файлы» */
export type KbFile = {
  attachment: KbAttachment;
  articleId: string;
  articleTitle: string;
  author: Person;
  updatedAt: IsoDate;
};

export async function fetchKnowledgeFiles(): Promise<KbFile[]> {
  const files = await api.get<ApiFile[]>('/knowledge/files');
  return files.map((f) => ({
    attachment: toAttachment(f.attachment),
    articleId: f.articleId,
    articleTitle: f.articleTitle,
    author: toPerson(f.author),
    updatedAt: f.updatedAt,
  }));
}

/** Вложения статей из открытых пользователю разделов — для раздела «Файлы» */
export function useKnowledgeFiles(enabled = true) {
  const roles = useRoles();
  return useQuery({
    enabled,
    queryKey: [...knowledgeKey, 'files', roles],
    queryFn: fetchKnowledgeFiles,
  });
}

/** Статьи (из доступных), где упомянут документ — для карточки документа */
export async function fetchDocumentArticles(doc: KbRelatedDocument): Promise<KbArticleSummary[]> {
  const articles = await api.get<ApiSummary[]>('/knowledge/articles', {
    query: { document: doc.number },
  });
  return articles.map(toSummary);
}

export function useDocumentArticles(doc: KbRelatedDocument | null) {
  const roles = useRoles();
  return useQuery({
    enabled: doc !== null,
    queryKey: [...knowledgeKey, 'document', doc?.number, roles],
    queryFn: () => (doc ? fetchDocumentArticles(doc) : []),
  });
}

/** Документы, которые можно связать со статьёй, — зарегистрированные в разделе «Документы» */
export function useLinkableDocuments() {
  const documents = useDocuments();
  const data = documents.data?.flatMap((d): KbRelatedDocument[] => {
    const number = docRef(d);
    return number ? [{ number, title: d.title }] : [];
  });
  return { ...documents, data };
}

// --- Вложения ---------------------------------------------------------------------------------

/**
 * Файлы, выбранные в редакторе, но ещё не загруженные: статья может быть не создана, поэтому
 * файл уходит на бэкенд при сохранении статьи (useSaveArticle). ID таких вложений — с «new:».
 */
const pending = new Map<string, File>();
const isPending = (id: string) => id.startsWith('new:');

export function uploadAttachment(file: File): KbAttachment {
  const attachment = {
    id: `new:${crypto.randomUUID()}`,
    ...splitFilename(file.name),
    size: file.size,
  };
  pending.set(attachment.id, file);
  return attachment;
}

/** Адрес файла вложения на бэкенде; inline — открыть в браузере, а не скачать */
export const attachmentUrl = (id: string, { inline = false } = {}) =>
  api.url(`/knowledge/attachments/${id}/download`, inline ? { inline: 1 } : undefined);

/**
 * Где взять файл вложения: загруженный — ссылка на бэкенд (cookie сессии уходят сами),
 * ещё не сохранённый — файл из памяти вкладки.
 */
export function attachmentSource(
  attachment: KbAttachment,
  { inline = false } = {},
): { url: string; revoke?: () => void } {
  const file = pending.get(attachment.id);
  if (file) {
    const url = URL.createObjectURL(file);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  }
  return { url: attachmentUrl(attachment.id, { inline }) };
}

// --- Разделы ----------------------------------------------------------------------------------

/** Название раздела: длина без учёта повторяющихся пробелов (повторы проверяет бэкенд) */
export const SECTION_NAME_MIN = 3;
export const SECTION_NAME_MAX = 60;

const invalidateKnowledge = (client: ReturnType<typeof useQueryClient>) =>
  client.invalidateQueries({ queryKey: knowledgeKey });

/**
 * Кому открыт раздел: null — всем ролям, иначе только перечисленным. Закрытый раздел
 * остальные видят в списке, но его статьи не приходят, не ищутся и не считаются.
 */
export function useSectionAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: RoleCode[] | null }) =>
      api.patch<KbSection>(`/knowledge/sections/${id}`, { roles }),
    meta: { successMessage: 'knowledge.accessSaved' },
    onSuccess: () => invalidateKnowledge(client),
  });
}

/** Новый раздел — открыт всем ролям. Разделы, как и статьи, не удаляются */
export function useCreateSection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<KbSection>('/knowledge/sections', { name }),
    // Ошибку (повтор названия) показывает поле в окне
    meta: {
      successMessage: (section: KbSection) => ({
        key: 'knowledge.sectionCreated',
        params: { name: section.name },
      }),
      errorMessage: false,
    },
    onSuccess: () => invalidateKnowledge(client),
  });
}

/** Переименовать раздел: те же правила, что при создании; статьи остаются в разделе */
export function useRenameSection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<KbSection>(`/knowledge/sections/${id}`, { name }),
    meta: {
      successMessage: (section: KbSection) => ({
        key: 'knowledge.sectionRenamed',
        params: { name: section.name },
      }),
      errorMessage: false,
    },
    onSuccess: () => invalidateKnowledge(client),
  });
}

/** Сдвинуть раздел в списке на одну позицию вверх (-1) или вниз (1) */
export function useMoveSection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, by }: { id: string; by: -1 | 1 }) =>
      api.post<void>(`/knowledge/sections/${id}/move`, { by }),
    onSuccess: () => invalidateKnowledge(client),
  });
}

// --- Статьи -----------------------------------------------------------------------------------

/** Что пользователь меняет в редакторе */
export type ArticleDraft = {
  sectionId: string;
  title: string;
  summary: string;
  body: KbBlock[];
  /** Загруженные вложения и новые файлы (ID с «new:» — загрузятся при сохранении) */
  attachments: KbAttachment[];
  relatedTasks: KbRelatedTask[];
  relatedDocuments: KbRelatedDocument[];
  /** Что изменено — строка в истории версий */
  change: string;
};

/**
 * Создать статью (article = null) или сохранить новую версию. Статью не удаляют и версии не
 * переписывают: изменение текста, описания или связей добавляет версию в историю. Затем
 * загружаются новые файлы, убранные из статьи вложения уходят в архив.
 */
export async function saveArticle(article: KbArticle | null, draft: ArticleDraft) {
  const payload = {
    sectionId: draft.sectionId,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    body: blocksToMarkdown(draft.body),
    change: draft.change.trim(),
    relatedTasks: draft.relatedTasks,
    relatedDocuments: draft.relatedDocuments,
  };
  const saved = article
    ? await api.patch<ApiArticle>(`/knowledge/articles/${article.id}`, {
        ...payload,
        version: article.version,
      })
    : await api.post<ApiArticle>('/knowledge/articles', payload);

  const kept = new Set(draft.attachments.map((a) => a.id));
  const removed = (article?.attachments ?? []).filter((a) => !kept.has(a.id) && !isPending(a.id));
  for (const a of removed) {
    await api.post(`/knowledge/attachments/${a.id}/archive`, { archived: true });
  }
  const added = draft.attachments.filter((a) => isPending(a.id));
  for (const a of added) {
    const file = pending.get(a.id);
    if (!file) continue;
    const form = new FormData();
    form.append('file', file, file.name);
    await api.post(`/knowledge/articles/${saved.id}/attachments`, form);
    pending.delete(a.id);
  }
  return removed.length || added.length ? fetchArticle(saved.id) : toArticle(saved);
}

export function useSaveArticle(article: KbArticle | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: ArticleDraft) => saveArticle(article, draft),
    meta: {
      successMessage: (saved: KbArticle) => ({
        key: article ? 'knowledge.saved' : 'knowledge.created',
        params: { title: saved.title, version: saved.version },
      }),
    },
    onSuccess: () => invalidateKnowledge(client),
  });
}

/**
 * «Проверено, актуально»: текст верен, правок нет. Версия не добавляется, «Давно не обновляли»
 * снимается — актуальность считается от даты проверки.
 */
export function useMarkReviewed(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      toArticle(await api.post<ApiArticle>(`/knowledge/articles/${id}/review`)),
    meta: { successMessage: { key: 'knowledge.reviewedToast' } },
    onSuccess: () => invalidateKnowledge(client),
  });
}
