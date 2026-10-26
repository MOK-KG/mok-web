import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { currentUserId, people } from '@/features/tasks/directory';
import { ApiError } from '@/shared/api/errors';
import type { RoleCode } from '@/shared/config/permissions';
import { todayInBishkek } from '@/shared/lib/workDays';
import { createMockKnowledge } from './mock';
import { matchesQuery, queryStems } from './search';
import type { KbArticle, KbArticleSummary, KbBlock, KbHiddenMatches, KbSection } from './types';

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
  tasksCount,
  documentsCount,
}: KbArticle): KbArticleSummary => ({
  id,
  sectionId,
  title,
  summary,
  author,
  updatedAt,
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

/** Что пользователь меняет в редакторе. Вложения и связи редактор пока не трогает */
export type ArticleDraft = {
  sectionId: string;
  title: string;
  summary: string;
  body: KbBlock[];
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
    updatedAt: today,
  };

  let article: KbArticle;
  if (id === null) {
    const next = Math.max(0, ...store.articles.map((a) => Number(a.id.slice(3)) || 0)) + 1;
    article = {
      id: `kb-${next}`,
      ...fields,
      author: editor,
      tasksCount: 0,
      documentsCount: 0,
      version: 1,
      attachments: [],
      relatedTasks: [],
      relatedDocuments: [],
      versions: [{ number: 1, date: today, author: editor, change: draft.change.trim() }],
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
        { number: version, date: today, author: editor, change: draft.change.trim() },
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
