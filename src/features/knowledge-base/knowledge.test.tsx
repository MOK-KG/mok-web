import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import type { RoleCode } from '@/shared/config/permissions';
import { addDays } from '@/shared/lib/workDays';
import { fetchArticle, fetchKnowledge, resetKnowledgeMock, searchKnowledge } from './api';
import { createMockKnowledge } from './mock';
import { freshnessOf, matchesQuery, queryStems } from './search';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = '2026-09-05';
const QUERY = 'перевод документов';

describe('база знаний (логика)', () => {
  it('актуальность: до 7 дней — «Актуально», с 30 дней — «Давно не обновляли»', () => {
    expect(freshnessOf(addDays(TODAY, -7), TODAY)).toBe('fresh');
    expect(freshnessOf(addDays(TODAY, -8), TODAY)).toBeNull();
    expect(freshnessOf(addDays(TODAY, -29), TODAY)).toBeNull();
    expect(freshnessOf(addDays(TODAY, -30), TODAY)).toBe('stale');
  });

  it('поиск без окончаний и без учёта ё и регистра', () => {
    expect(queryStems('Перевод  документов!')).toEqual(['перев', 'документ']);
    const article = { title: 'Перевода документа', summary: '', body: [] };
    expect(matchesQuery(article, QUERY)).toBe(true);
    expect(matchesQuery(article, 'перевод счёта')).toBe(false);
    expect(matchesQuery(article, '   ')).toBe(true);
  });

  it('закрытый раздел: статьи не приходят, не ищутся и не считаются, по ссылке — 403', () => {
    resetKnowledgeMock(TODAY);
    const roles: RoleCode[] = ['R1'];
    const { sections, articles } = fetchKnowledge(roles);
    const legal = sections.find((s) => s.id === 'legal');
    expect(legal).toMatchObject({ accessible: false, count: 9 });
    expect(articles.some((a) => a.sectionId === 'legal')).toBe(false);
    // «Все статьи» = сумма открытых разделов
    const open = sections.filter((s) => s.accessible).reduce((n, s) => n + s.count, 0);
    expect(articles.length).toBe(open);
    expect(articles.length).toBe(55);

    const search = searchKnowledge(QUERY, roles);
    expect(search.ids).toHaveLength(3);
    expect(search.hidden).toEqual([{ sectionId: 'legal', sectionName: 'Правовая база', count: 2 }]);

    const legalArticle = createMockKnowledge(TODAY).articles.find((a) => a.sectionId === 'legal');
    expect(() => fetchArticle(legalArticle?.id ?? '', roles)).toThrow(
      expect.objectContaining({ status: 403 }),
    );
    expect(() => fetchArticle('kb-404', roles)).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('роли, которой раздел открыт, он виден целиком: 64 статьи, 5 найдено, скрытых нет', () => {
    resetKnowledgeMock(TODAY);
    expect(fetchKnowledge(['R6']).articles).toHaveLength(64);
    expect(searchKnowledge(QUERY, ['R6'])).toMatchObject({ hidden: [] });
    expect(searchKnowledge(QUERY, ['R6']).ids).toHaveLength(5);
  });

  it('числа связей в списке совпадают с карточкой статьи', () => {
    for (const a of createMockKnowledge(TODAY).articles) {
      expect(a.tasksCount).toBe(a.relatedTasks.length);
      expect(a.documentsCount).toBe(a.relatedDocuments.length);
    }
  });
});

let root: Root;
let container: HTMLDivElement;
const text = () => container.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${text().slice(0, 400)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};

async function open(url: string, role: RoleCode = 'R1') {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
  resetKnowledgeMock();
  await i18n.changeLanguage('ru');
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  );
}

describe('база знаний (экраны)', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('поиск в разделе: счётчики совпадают с подсвеченными статьями', async () => {
    await open(`/knowledge?section=records&q=${encodeURIComponent(QUERY)}`);
    await waitFor(() => text().includes('Найдено'));
    expect(text()).toContain('55 статей в 6 разделах');
    expect(text()).toContain(`Найдено 3 статьи по запросу «${QUERY}»`);
    expect(text()).toContain('14 статей · 3 найдено');
    expect(text()).toContain('Ещё 2 статьи с этим словом есть в разделе «Правовая база»');

    const list = container.querySelector('section[aria-label="Делопроизводство"]');
    const rows = list?.querySelectorAll('a[href^="/knowledge/"]') ?? [];
    expect(rows).toHaveLength(14);
    // Найденные — первыми и с подсветкой
    const found = [...rows].filter((r) => r.className.includes('bg-row-match'));
    expect(found).toHaveLength(3);
    expect([...rows].slice(0, 3)).toEqual(found);
  });

  it('закрытый раздел виден, но не открывается', async () => {
    await open('/knowledge');
    await waitFor(() => text().includes('Правовая база'));
    const nav = container.querySelector('nav[aria-label="Разделы"]');
    const buttons = [...(nav?.querySelectorAll('button') ?? [])].map((b) => b.textContent);
    expect(buttons.some((b) => b?.includes('Правовая база'))).toBe(false);
    expect(nav?.querySelector('[aria-disabled]')?.textContent).toContain('Правовая база');
  });

  it('статья: содержание, связанные задачи и история версий', async () => {
    await open('/knowledge/kb-1');
    await waitFor(() => text().includes('История версий'));
    expect(container.querySelector('article h2')?.textContent).toBe(
      'Порядок официального перевода документов',
    );
    const toc = [...container.querySelectorAll('aside a[href^="#"]')].map((a) => a.textContent);
    expect(toc).toEqual([
      'Когда нужен нотариальный перевод',
      'Кто заказывает и в какие сроки',
      'Вложения',
    ]);
    expect(text()).toContain('Связанные задачи3');
    expect(text()).toContain('Версия 4');
  });

  it('статья закрытого раздела по прямой ссылке — 403, а не пустая страница', async () => {
    const legal = createMockKnowledge().articles.find((a) => a.sectionId === 'legal');
    await open(`/knowledge/${legal?.id}`);
    await waitFor(() => text().includes('403'));
  });
});

const type = (el: HTMLInputElement | HTMLTextAreaElement | null | undefined, value: string) => {
  if (!el) throw new Error('Нет поля');
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const button = (label: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

describe('редактор статьи', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('новая статья: публикуется в выбранный раздел, версия 1, счётчик раздела растёт', async () => {
    await open('/knowledge/new?section=records');
    await waitFor(() => !!button('Опубликовать'));
    type(
      container.querySelector('input[placeholder="Заголовок статьи"]'),
      'Порядок выдачи справок',
    );
    type(
      container.querySelector('textarea[name="summary"]'),
      'Кто выдаёт справки сотрудникам и в какие сроки.',
    );
    type(container.querySelector('textarea[name="blocks.0.text"]'), 'Справку выдаёт отдел кадров.');
    await act(async () => button('Опубликовать')?.click());
    await waitFor(() => text().includes('История версий'));
    expect(container.querySelector('article h2')?.textContent).toBe('Порядок выдачи справок');
    expect(text()).toContain('Версия 1');
    expect(text()).toContain('первая редакция');
    expect(fetchKnowledge(['R1']).sections.find((s) => s.id === 'records')?.count).toBe(15);
  });

  it('пустая форма не сохраняется: ошибки у полей', async () => {
    await open('/knowledge/new');
    await waitFor(() => !!button('Опубликовать'));
    type(container.querySelector('textarea[name="blocks.0.text"]'), '');
    await act(async () => button('Опубликовать')?.click());
    await waitFor(() => text().includes('Выберите раздел'));
    expect(text()).toContain('Заголовок — не короче 3 символов');
    expect(text()).toContain('Описание — от 10 до 200 символов');
    expect(text()).toContain('Заполните блок или удалите его');
  });

  it('правка: без «Что изменено» не сохраняется, с ним — новая версия в истории', async () => {
    await open('/knowledge/kb-1/edit');
    await waitFor(() => !!button('Сохранить'));
    await act(async () => button('Сохранить')?.click());
    await waitFor(() => text().includes('Опишите, что изменилось'));

    type(container.querySelector('input[name="change"]'), 'добавлены сроки для МОК');
    await act(async () => button('Сохранить')?.click());
    await waitFor(() => text().includes('История версий'));
    expect(text()).toContain('версия 5');
    expect(text()).toContain('Версия 5');
    expect(text()).toContain('А. Дуйшеев — добавлены сроки для МОК');
    // Якоря заголовков сохранились — содержание по-прежнему ведёт к ним
    expect(container.querySelector('#when')).not.toBeNull();
  });

  it('без права knowledge.edit редактор по прямой ссылке — 403', async () => {
    await open('/knowledge/new', 'R9');
    await waitFor(() => text().includes('403'));
    expect(button('Опубликовать')).toBeUndefined();
  });
});
