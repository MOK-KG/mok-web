import { beforeEach, describe, expect, it } from 'vitest';
import { fetchMemberMessages, resetChatMock } from '../chat/api';
import { fetchDocuments, resetDocumentsMock } from '../documents/api';
import { fetchKnowledge, searchKnowledge } from '../knowledge-base/api';
import { createMockTasks } from '../tasks/mock';
import { highlight, type SearchSources, searchAll, snippetOf } from './search';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

beforeEach(() => {
  resetDocumentsMock(TODAY);
  resetChatMock();
});

/** Источники так, как их получит пользователь с этими ролями и правами */
function sourcesFor(roles: ('R3' | 'R6')[], query: string, docs: boolean): SearchSources {
  return {
    tasks: (({ department, archive }) => [...department, ...archive])(createMockTasks(TODAY)),
    documents: docs ? fetchDocuments() : [],
    articles: fetchKnowledge(roles).articles,
    articleIds: searchKnowledge(query, roles).ids,
    messages: fetchMemberMessages(),
  };
}

const total = (r: ReturnType<typeof searchAll>) =>
  Object.values(r).reduce((n, list) => n + list.length, 0);

describe('поиск по системе', () => {
  it('находит во всех разделах по основе слова', () => {
    const r = searchAll('перевода устава', sourcesFor(['R3'], 'перевода устава', true));
    expect(r.tasks.map((h) => h.title)).toContain('Перевод устава на кыргызский язык');
    expect(r.documents.map((h) => h.subtitle)).toContain('Вх. №2026-0884 · Минюст');
    expect(r.knowledge.length).toBeGreaterThan(0);
  });

  it('документ без доступа не находится и не считается (приёмка 11.3)', () => {
    const query = 'Минюст';
    const withAccess = searchAll(query, sourcesFor(['R3'], query, true));
    const without = searchAll(query, sourcesFor(['R3'], query, false));
    expect(withAccess.documents.length).toBeGreaterThan(0);
    expect(without.documents).toEqual([]);
    // Остальные разделы те же — разница в счётчике ровно на документы
    expect(total(without)).toBe(total(withAccess) - withAccess.documents.length);
  });

  it('статья закрытого раздела не находится — ни в результатах, ни в счётчике', () => {
    const query = 'Устав НОК КР';
    const closed = searchAll(query, sourcesFor(['R3'], query, true));
    const open = searchAll(query, sourcesFor(['R6'], query, true));
    expect(open.knowledge.map((h) => h.title)).toContain('Устав НОК КР');
    expect(closed.knowledge.map((h) => h.title)).not.toContain('Устав НОК КР');
  });

  it('пустой или однобуквенный запрос — пусто', () => {
    expect(total(searchAll('', sourcesFor(['R3'], '', true)))).toBe(0);
    expect(total(searchAll('а', sourcesFor(['R3'], 'а', true)))).toBe(0);
  });

  it('переписки — только где пользователь участник', () => {
    const r = searchAll('смета', sourcesFor(['R3'], 'смета', true));
    expect(r.chat.length).toBeGreaterThan(0);
    expect(r.chat.every((h) => h.target.kind === 'chat')).toBe(true);
  });
});

describe('отрывок и подсветка', () => {
  it('отрывок вокруг найденного', () => {
    expect(snippetOf('Министерство юстиции просит перевод устава', ['перевод'])).toContain(
      'перевод',
    );
    expect(snippetOf('ничего', ['перевод'])).toBeNull();
  });

  it('подсветка без учёта регистра и ё', () => {
    expect(highlight('Перевод Устава', ['устав'])).toEqual([
      { text: 'Перевод ', hit: false },
      { text: 'Устава', hit: true },
    ]);
    // Основа «миню» подсвечивает слово целиком
    expect(highlight('Минюст ждёт', ['миню'])[0]).toEqual({ text: 'Минюст', hit: true });
  });
});
