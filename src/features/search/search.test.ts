import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMemberMessages, resetChatMock } from '../chat/api';
import { fetchDocuments, resetDocumentsMock } from '../documents/api';
import { fetchKnowledge, searchKnowledge } from '../knowledge-base/api';
import { installKnowledgeServer } from '../knowledge-base/testing/server';
import { createMockTasks } from '../tasks/mock';
import { highlight, type SearchSources, searchAll, snippetOf } from './search';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

beforeEach(() => {
  resetDocumentsMock(TODAY);
  resetChatMock();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

/** Источники так, как их получит пользователь с этими ролями и правами */
async function sourcesFor(
  roles: ('R3' | 'R6')[],
  query: string,
  docs: boolean,
): Promise<SearchSources> {
  installKnowledgeServer({ today: TODAY, roles });
  return {
    tasks: (({ department, archive }) => [...department, ...archive])(createMockTasks(TODAY)),
    documents: docs ? fetchDocuments() : [],
    articles: (await fetchKnowledge()).articles,
    articleIds: query.trim().length > 1 ? (await searchKnowledge(query)).ids : [],
    messages: fetchMemberMessages(),
  };
}

const total = (r: ReturnType<typeof searchAll>) =>
  Object.values(r).reduce((n, list) => n + list.length, 0);

describe('поиск по системе', () => {
  it('находит во всех разделах по основе слова', async () => {
    const r = searchAll('перевода устава', await sourcesFor(['R3'], 'перевода устава', true));
    expect(r.tasks.map((h) => h.title)).toContain('Перевод устава на кыргызский язык');
    expect(r.documents.map((h) => h.subtitle)).toContain('Вх. №2026-0884 · Минюст');
    expect(r.knowledge.length).toBeGreaterThan(0);
  });

  it('документ без доступа не находится и не считается (приёмка 11.3)', async () => {
    const query = 'Минюст';
    const withAccess = searchAll(query, await sourcesFor(['R3'], query, true));
    const without = searchAll(query, await sourcesFor(['R3'], query, false));
    expect(withAccess.documents.length).toBeGreaterThan(0);
    expect(without.documents).toEqual([]);
    // Остальные разделы те же — разница в счётчике ровно на документы
    expect(total(without)).toBe(total(withAccess) - withAccess.documents.length);
  });

  it('статья закрытого раздела не находится — ни в результатах, ни в счётчике', async () => {
    const query = 'Устав НОК КР';
    const closed = searchAll(query, await sourcesFor(['R3'], query, true));
    const open = searchAll(query, await sourcesFor(['R6'], query, true));
    expect(open.knowledge.map((h) => h.title)).toContain('Устав НОК КР');
    expect(closed.knowledge.map((h) => h.title)).not.toContain('Устав НОК КР');
  });

  it('пустой или однобуквенный запрос — пусто', async () => {
    expect(total(searchAll('', await sourcesFor(['R3'], '', true)))).toBe(0);
    expect(total(searchAll('а', await sourcesFor(['R3'], 'а', true)))).toBe(0);
  });

  it('переписки — только где пользователь участник', async () => {
    const r = searchAll('смета', await sourcesFor(['R3'], 'смета', true));
    expect(r.chat.length).toBeGreaterThan(0);
    expect(r.chat.every((h) => h.target.kind === 'chat')).toBe(true);
  });
});

describe('отрывок и подсветка', () => {
  it('отрывок вокруг найденного', async () => {
    expect(snippetOf('Министерство юстиции просит перевод устава', ['перевод'])).toContain(
      'перевод',
    );
    expect(snippetOf('ничего', ['перевод'])).toBeNull();
  });

  it('подсветка без учёта регистра и ё', async () => {
    expect(highlight('Перевод Устава', ['устав'])).toEqual([
      { text: 'Перевод ', hit: false },
      { text: 'Устава', hit: true },
    ]);
    // Основа «миню» подсвечивает слово целиком
    expect(highlight('Минюст ждёт', ['миню'])[0]).toEqual({ text: 'Минюст', hit: true });
  });
});
