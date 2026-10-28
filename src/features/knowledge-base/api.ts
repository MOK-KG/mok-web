import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { currentUserId, people } from '@/features/tasks/directory';
import { ApiError } from '@/shared/api/errors';
import type { RoleCode } from '@/shared/config/permissions';
import { todayInBishkek } from '@/shared/lib/workDays';
import { createMockKnowledge, documentPool } from './mock';
import { matchesQuery, queryStems } from './search';
import type {
  KbArticle,
  KbArticleSummary,
  KbAttachment,
  KbBlock,
  KbHiddenMatches,
  KbRelatedDocument,
  KbRelatedTask,
  KbSection,
} from './types';

/**
 * Данные базы знаний. Пока бэкенда нет — заглушка в памяти (mock.ts); когда появится API,
 * меняются только функции fetch*, хуки и интерфейс остаются.
 *
 * Права проверяет бэкенд: статьи закрытых разделов не приходят ни в списке, ни в поиске,
 * а по прямой ссылке — ошибка 403.
 */
let store = createMockKnowledge();

const delay = (ms: number) =>
  new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : ms));

/** Сброс заглушки (для тестов) */
export function resetKnowledgeMock(today?: string) {
  store = createMockKnowledge(today);
}

const isOpen = (sectionId: string, roles: RoleCode[]) => {
  const section = store.sections.find((s) => s.id === sectionId);
  return !section?.openTo || section.openTo.some((r) => roles.includes(r));
};

const toSummary = ({
  id,
  sectionId,
  title,
  summary,
  author,
  updatedAt,
  reviewed,
  tasksCount,
  documentsCount,
}: KbArticle): KbArticleSummary => ({
  id,
  sectionId,
  title,
  summary,
  author,
  updatedAt,
  reviewed,
  tasksCount,
  documentsCount,
});

export type KnowledgeList = { sections: KbSection[]; articles: KbArticleSummary[] };

export function fetchKnowledge(roles: RoleCode[]): KnowledgeList {
  return {
    sections: store.sections.map(({ id, name, count }) => ({
      id,
      name,
      count,
      accessible: isOpen(id, roles),
    })),
    articles: store.articles
      .filter((a) => isOpen(a.sectionId, roles))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toSummary),
  };
}

export type KnowledgeSearch = { ids: string[]; hidden: KbHiddenMatches[] };

/** Поиск по заголовку, описанию и тексту. Закрытые разделы — только число совпадений */
export function searchKnowledge(query: string, roles: RoleCode[]): KnowledgeSearch {
  const matched = store.articles.filter((a) => matchesQuery(a, query));
  const hidden = store.sections
    .filter((s) => !isOpen(s.id, roles))
    .map((s) => ({
      sectionId: s.id,
      sectionName: s.name,
      count: matched.filter((a) => a.sectionId === s.id).length,
    }))
    .filter((h) => h.count > 0);
  return { ids: matched.filter((a) => isOpen(a.sectionId, roles)).map((a) => a.id), hidden };
}

export function fetchArticle(id: string, roles: RoleCode[]): KbArticle {
  const article = store.articles.find((a) => a.id === id);
  if (!article) throw new ApiError(404, 'Not found');
  if (!isOpen(article.sectionId, roles)) throw new ApiError(403, 'Forbidden');
  return structuredClone(article);
}

export const knowledgeKey = ['knowledge'] as const;

const useRoles = () => (useSession().data?.user.roles ?? []) as RoleCode[];

export function useKnowledge() {
  const roles = useRoles();
  return useQuery({
    queryKey: [...knowledgeKey, 'list', roles],
    queryFn: async () => {
      await delay(120);
      return fetchKnowledge(roles);
    },
  });
}

export function useKnowledgeSearch(query: string) {
  const roles = useRoles();
  const enabled = queryStems(query).length > 0;
  return useQuery({
    queryKey: [...knowledgeKey, 'search', query.trim(), roles],
    queryFn: async () => {
      await delay(80);
      return searchKnowledge(query, roles);
    },
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useArticle(id: string, { enabled = true } = {}) {
  const roles = useRoles();
  return useQuery({
    enabled,
    queryKey: [...knowledgeKey, 'article', id, roles],
    queryFn: async () => {
      await delay(120);
      return fetchArticle(id, roles);
    },
    // 403 и 404 не повторяем — ответ не изменится
    retry: (count, error) =>
      !(error instanceof ApiError && [403, 404].includes(error.status)) && count < 2,
  });
}

/** Название раздела: длина и уникальность без учёта регистра и пробелов */
export const SECTION_NAME_MIN = 3;
export const SECTION_NAME_MAX = 60;
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

/**
 * Новый раздел (право knowledge.edit проверяет маршрут, в API — бэкенд). Раздел открыт всем
 * ролям; закрывают раздел на бэкенде. Разделы, как и статьи, не удаляются.
 */
export function createSection(name: string): KbSection {
  const clean = normalizeName(name);
  if (clean.length < SECTION_NAME_MIN || clean.length > SECTION_NAME_MAX) {
    throw new ApiError(400, 'Invalid name', { code: 'section_name' });
  }
  if (store.sections.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
    throw new ApiError(409, 'Duplicate section', { code: 'section_exists' });
  }
  const next = Math.max(0, ...store.sections.map((s) => Number(s.id.slice(4)) || 0)) + 1;
  const section = { id: `sec-${next}`, name: clean, openTo: undefined, count: 0 };
  store.sections.push(section);
  return { id: section.id, name: section.name, count: 0, accessible: true };
}

/** Переименовать раздел: те же правила, что при создании; статьи остаются в разделе */
export function renameSection(id: string, name: string): KbSection {
  const clean = normalizeName(name);
  const section = store.sections.find((s) => s.id === id);
  if (!section) throw new ApiError(404, 'Not found');
  if (clean.length < SECTION_NAME_MIN || clean.length > SECTION_NAME_MAX) {
    throw new ApiError(400, 'Invalid name', { code: 'section_name' });
  }
  if (store.sections.some((s) => s.id !== id && s.name.toLowerCase() === clean.toLowerCase())) {
    throw new ApiError(409, 'Duplicate section', { code: 'section_exists' });
  }
  section.name = clean;
  return { id, name: clean, count: section.count, accessible: true };
}

/** Сдвинуть раздел в списке на одну позицию вверх (-1) или вниз (1) */
export function moveSection(id: string, by: -1 | 1) {
  const from = store.sections.findIndex((s) => s.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= store.sections.length) return;
  const [section] = store.sections.splice(from, 1);
  store.sections.splice(to, 0, section);
}

export function useCreateSection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await delay(120);
      return createSection(name);
    },
    // Ошибку (повтор названия) показывает поле в окне
    meta: {
      successMessage: (section: KbSection) => ({
        key: 'knowledge.sectionCreated',
        params: { name: section.name },
      }),
      errorMessage: false,
    },
    onSuccess: () => client.invalidateQueries({ queryKey: knowledgeKey }),
  });
}

export function useRenameSection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await delay(120);
      return renameSection(id, name);
    },
    meta: {
      successMessage: (section: KbSection) => ({
        key: 'knowledge.sectionRenamed',
        params: { name: section.name },
      }),
      errorMessage: false,
    },
    onSuccess: () => client.invalidateQueries({ queryKey: knowledgeKey }),
  });
}

export function useMoveSection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, by }: { id: string; by: -1 | 1 }) => {
      await delay(80);
      moveSection(id, by);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: knowledgeKey }),
  });
}

/** Документы, которые можно связать со статьёй (до раздела «Документы» — из заглушки) */
export function useLinkableDocuments() {
  return useQuery({
    queryKey: [...knowledgeKey, 'documents'],
    queryFn: async () => {
      await delay(80);
      return structuredClone(documentPool);
    },
  });
}

/** Что пользователь меняет в редакторе */
export type ArticleDraft = {
  sectionId: string;
  title: string;
  summary: string;
  body: KbBlock[];
  /** Файлы в заглушке не хранятся — только имя и расширение */
  attachments: KbAttachment[];
  relatedTasks: KbRelatedTask[];
  relatedDocuments: KbRelatedDocument[];
  /** Что изменено — строка в истории версий */
  change: string;
};

/** Автор правки в заглушке — текущий пользователь (Айбек Дуйшеев) */
const me = () => Object.values(people).find((p) => p.id === currentUserId) ?? people.ad;

/**
 * Создать статью (id = null) или сохранить новую версию. Статью не удаляют и версии не
 * переписывают: каждое сохранение добавляет версию в историю.
 */
export function saveArticle(id: string | null, draft: ArticleDraft, roles: RoleCode[]): KbArticle {
  if (!store.sections.some((s) => s.id === draft.sectionId) || !isOpen(draft.sectionId, roles)) {
    throw new ApiError(403, 'Forbidden');
  }
  const today = todayInBishkek();
  const editor = me();
  const fields = {
    sectionId: draft.sectionId,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    body: draft.body,
    attachments: draft.attachments,
    relatedTasks: draft.relatedTasks,
    relatedDocuments: draft.relatedDocuments,
    // Счётчики в списке — те же связи, что в карточке статьи
    tasksCount: draft.relatedTasks.length,
    documentsCount: draft.relatedDocuments.length,
    updatedAt: today,
  };

  // Текст версии сохраняется целиком — старую версию можно открыть и сравнить
  const snap = { title: fields.title, summary: fields.summary, body: fields.body };

  let article: KbArticle;
  if (id === null) {
    const next = Math.max(0, ...store.articles.map((a) => Number(a.id.slice(3)) || 0)) + 1;
    article = {
      id: `kb-${next}`,
      ...fields,
      author: editor,
      version: 1,
      reviewed: null,
      versions: [{ number: 1, date: today, author: editor, change: draft.change.trim(), ...snap }],
    };
    store.articles.push(article);
  } else {
    const index = store.articles.findIndex((a) => a.id === id);
    const current = store.articles[index];
    if (!current) throw new ApiError(404, 'Not found');
    if (!isOpen(current.sectionId, roles)) throw new ApiError(403, 'Forbidden');
    const version = current.version + 1;
    article = {
      ...current,
      ...fields,
      version,
      versions: [
        { number: version, date: today, author: editor, change: draft.change.trim(), ...snap },
        ...current.versions,
      ],
    };
    store.articles[index] = article;
  }
  for (const section of store.sections) {
    section.count = store.articles.filter((a) => a.sectionId === section.id).length;
  }
  return structuredClone(article);
}

export function useSaveArticle(id: string | null) {
  const roles = useRoles();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (draft: ArticleDraft) => {
      await delay(150);
      return saveArticle(id, draft, roles);
    },
    meta: {
      successMessage: (article: KbArticle) => ({
        key: id ? 'knowledge.saved' : 'knowledge.created',
        params: { title: article.title, version: article.version },
      }),
    },
    onSuccess: () => client.invalidateQueries({ queryKey: knowledgeKey }),
  });
}

/**
 * «Проверено, актуально»: текст верен, правок нет. Версия не добавляется, «Давно не обновляли»
 * снимается — актуальность считается от даты проверки.
 */
export function markReviewed(id: string, roles: RoleCode[]): KbArticle {
  const article = store.articles.find((a) => a.id === id);
  if (!article) throw new ApiError(404, 'Not found');
  if (!isOpen(article.sectionId, roles)) throw new ApiError(403, 'Forbidden');
  article.reviewed = { date: todayInBishkek(), by: me() };
  return structuredClone(article);
}

export function useMarkReviewed(id: string) {
  const roles = useRoles();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await delay(120);
      return markReviewed(id, roles);
    },
    meta: { successMessage: { key: 'knowledge.reviewedToast' } },
    onSuccess: () => client.invalidateQueries({ queryKey: knowledgeKey }),
  });
}
