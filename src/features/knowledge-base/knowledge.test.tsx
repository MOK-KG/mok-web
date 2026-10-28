import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { ApiError } from '@/shared/api/errors';
import type { RoleCode } from '@/shared/config/permissions';
import { addDays } from '@/shared/lib/workDays';
import {
  articlesWithDocument,
  createSection,
  fetchArticle,
  fetchAttachment,
  fetchKnowledge,
  markReviewed,
  moveSection,
  renameSection,
  resetKnowledgeMock,
  saveArticle,
  searchKnowledge,
  setSectionAccess,
  uploadAttachment,
} from './api';
import { parseDocumentNumber } from './DocumentDialog';
import { createMockKnowledge } from './mock';
import { checkedAt, freshnessOf, matchesQuery, queryStems } from './search';

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

  it('новый раздел: открыт всем, пустой, название без повторов и не короче 3 символов', () => {
    resetKnowledgeMock(TODAY);
    const section = createSection('  Закупки   и   тендеры ');
    expect(section).toMatchObject({ name: 'Закупки и тендеры', count: 0, accessible: true });
    expect(fetchKnowledge(['R1']).sections.at(-1)).toEqual(section);
    const codeOf = (name: string) => {
      try {
        createSection(name);
      } catch (e) {
        return e instanceof ApiError ? e.code : 'other';
      }
      return null;
    };
    expect(codeOf('закупки и ТЕНДЕРЫ')).toBe('section_exists');
    expect(codeOf('делопроизводство')).toBe('section_exists');
    expect(codeOf(' аб ')).toBe('section_name');
  });

  it('раздел переименовывается без повторов и сдвигается; статьи остаются в нём', () => {
    resetKnowledgeMock(TODAY);
    expect(renameSection('records', 'Документооборот')).toMatchObject({ count: 14 });
    expect(() => renameSection('records', 'антидопинг')).toThrow(ApiError);
    moveSection('records', 1);
    const names = fetchKnowledge(['R1']).sections.map((s) => s.name);
    expect(names.slice(0, 2)).toEqual(['Финансовые процессы', 'Документооборот']);
    moveSection('records', -1);
    moveSection('records', -1); // уже первый — не сдвигается
    expect(fetchKnowledge(['R1']).sections[0].name).toBe('Документооборот');
  });

  it('«Проверено, актуально» снимает «Давно не обновляли», версия не добавляется', () => {
    resetKnowledgeMock();
    const stale = fetchKnowledge(['R1']).articles.find(
      (a) => freshnessOf(checkedAt(a)) === 'stale',
    );
    if (!stale) throw new Error('нет устаревшей статьи');
    const before = fetchArticle(stale.id, ['R1']);
    const after = markReviewed(stale.id, ['R1']);
    expect(freshnessOf(checkedAt(after))).toBe('fresh');
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.versions).toHaveLength(before.versions.length);
  });

  it('каждая версия хранит свой текст; связанные задачи открываются', () => {
    const { articles } = createMockKnowledge(TODAY);
    for (const a of articles) {
      expect(a.versions[0].body).toEqual(a.body);
      for (const task of a.relatedTasks) expect(task.id).not.toBeNull();
    }
    resetKnowledgeMock(TODAY);
    const saved = saveArticle(
      'kb-1',
      {
        ...fetchArticle('kb-1', ['R1']),
        change: 'сокращено',
        body: [{ kind: 'paragraph', text: 'Коротко' }],
      },
      ['R1'],
    );
    expect(saved.versions[0]).toMatchObject({
      number: 5,
      body: [{ kind: 'paragraph', text: 'Коротко' }],
    });
    expect(saved.versions[1].body).toHaveLength(6);
  });

  it('доступ к разделу: закрытый для роли раздел виден, но статьи не приходят и не ищутся', () => {
    resetKnowledgeMock(TODAY);
    setSectionAccess('records', ['R6', 'R7']);
    const r1 = fetchKnowledge(['R1']);
    expect(r1.sections.find((s) => s.id === 'records')).toMatchObject({
      accessible: false,
      count: 14,
      roles: ['R6', 'R7'],
    });
    expect(r1.articles.some((a) => a.sectionId === 'records')).toBe(false);
    expect(searchKnowledge(QUERY, ['R1']).hidden.map((h) => h.sectionId)).toContain('records');
    expect(() => fetchArticle('kb-1', ['R1'])).toThrow(ApiError);
    expect(fetchKnowledge(['R7']).articles.some((a) => a.sectionId === 'records')).toBe(true);
    expect(() => setSectionAccess('records', [])).toThrow(ApiError);
    setSectionAccess('records', null);
    expect(fetchArticle('kb-1', ['R1']).id).toBe('kb-1');
  });

  it('вложение: загруженный файл скачивается как есть, демо-вложение — текстовой заглушкой', () => {
    resetKnowledgeMock(TODAY);
    const file = new File(['%PDF-1.4'], 'Положение о закупках.PDF', { type: 'application/pdf' });
    const attachment = uploadAttachment(file);
    expect(attachment).toMatchObject({ name: 'Положение о закупках', ext: 'pdf', size: 8 });
    expect(fetchAttachment(attachment)).toEqual({
      blob: file,
      fileName: 'Положение о закупках.pdf',
    });
    const demo = fetchAttachment(fetchArticle('kb-1', ['R1']).attachments[0]);
    expect(demo.fileName).toBe('Глоссарий терминов МОК на трёх языках.docx.txt');
  });

  it('документ: тип и корреспондент из номера, статьи с документом — только доступные', () => {
    expect(parseDocumentNumber('Вх. №2026-0884 · Минюст')).toEqual({
      kind: 'incoming',
      number: '№2026-0884',
      party: 'Минюст',
    });
    expect(parseDocumentNumber('Приказ №58 · НОК КР').kind).toBe('order');
    resetKnowledgeMock(TODAY);
    const doc = fetchArticle('kb-1', ['R1']).relatedDocuments[0];
    expect(articlesWithDocument(doc, ['R1']).map((a) => a.id)).toContain('kb-1');
    setSectionAccess('records', ['R6']);
    expect(articlesWithDocument(doc, ['R1']).map((a) => a.id)).not.toContain('kb-1');
  });

  it('статья с вложениями и связями: счётчики в списке совпадают со связями', () => {
    resetKnowledgeMock(TODAY);
    const section = createSection('Закупки');
    const article = saveArticle(
      null,
      {
        sectionId: section.id,
        title: 'Порядок закупок',
        summary: 'Кто согласует закупку и в какие сроки.',
        body: [{ kind: 'paragraph', text: 'Текст' }],
        attachments: [{ id: 'att-x', name: 'Положение', ext: 'pdf', size: 1200 }],
        relatedTasks: [{ id: null, title: 'Закупка ноутбуков', status: 'queue' }],
        relatedDocuments: [
          { number: 'Приказ №1', title: 'О закупках' },
          { number: 'Приказ №2', title: 'О тендерах' },
        ],
        change: 'первая редакция',
      },
      ['R7'],
    );
    const list = fetchKnowledge(['R7']);
    expect(list.sections.find((s) => s.id === section.id)?.count).toBe(1);
    expect(list.articles.find((a) => a.id === article.id)).toMatchObject({
      tasksCount: 1,
      documentsCount: 2,
    });
    expect(fetchArticle(article.id, ['R7']).attachments).toHaveLength(1);
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

  it('старая версия открывается только для чтения, с отметкой изменённого', async () => {
    await open('/knowledge/kb-1?version=2');
    await waitFor(() => text().includes('Версия 2 от'));
    expect(text()).not.toContain('Стандартный срок');
    expect(text()).not.toContain('Править');
    expect(
      container.querySelector('a[aria-current="page"][href*="version=2"]')?.textContent,
    ).toContain('Версия 2');
    const back = [...container.querySelectorAll('a')].find((l) =>
      l.textContent?.includes('К текущей версии 4'),
    );
    await act(async () => back?.click());
    await waitFor(() => text().includes('Стандартный срок'));
    expect(text()).not.toContain('Версия 2 от');
  });

  it('связанный документ открывается карточкой', async () => {
    await open('/knowledge/kb-1');
    await waitFor(() => text().includes('Вх. №2026-0884'));
    const card = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Вх. №2026-0884'),
    );
    await act(async () => card?.click());
    await waitFor(() => document.body.textContent?.includes('Статьи с этим документом') ?? false);
    expect(document.body.textContent).toContain('Входящий');
    expect(document.body.textContent).toContain('Корреспондент');
  });

  it('«Проверено, актуально» на устаревшей статье', async () => {
    await open('/knowledge/kb-5');
    await waitFor(() => text().includes('Давно не обновляли'));
    const button = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Проверено, актуально'),
    );
    await act(async () => button?.click());
    await waitFor(() => text().includes('проверено'));
    expect(text()).toContain('Актуально');
    expect(text()).not.toContain('Давно не обновляли');
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
const button = (label: string, scope: ParentNode = container) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

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
    await waitFor(() => !button('Опубликовать') && text().includes('История версий'));
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
    // «История версий» есть и в редакторе — ждём, пока откроется сама статья
    await waitFor(() => !button('Сохранить') && text().includes('История версий'));
    expect(text()).toContain('версия 5');
    expect(text()).toContain('Версия 5');
    expect(text()).toContain('А. Дуйшеев — добавлены сроки для МОК');
    // Якоря заголовков сохранились — содержание по-прежнему ведёт к ним
    expect(container.querySelector('#when')).not.toBeNull();
    // Вложения и связи, которых не касались, при сохранении не теряются
    expect(text()).toContain('Глоссарий терминов МОК на трёх языках');
    expect(text()).toContain('Перевод устава на кыргызский язык');
  });

  it('новый раздел из списка разделов: создаётся и сразу открывается', async () => {
    await open('/knowledge');
    await waitFor(() => !!container.querySelector('button[aria-label="Новый раздел"]'));
    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Новый раздел"]')?.click(),
    );
    await waitFor(() => !!document.querySelector('input[placeholder="Например: Закупки"]'));
    type(document.querySelector('input[placeholder="Например: Закупки"]'), 'Делопроизводство');
    await act(async () => button('Создать раздел', document.body)?.click());
    await waitFor(
      () => document.body.textContent?.includes('Раздел «Делопроизводство» уже есть') ?? false,
    );

    type(document.querySelector('input[placeholder="Например: Закупки"]'), 'Закупки');
    await act(async () => button('Создать раздел', document.body)?.click());
    await waitFor(() => text().includes('В разделе пока нет статей'));
    expect(
      container.querySelector('nav[aria-label="Разделы"] [aria-current="page"]')?.textContent,
    ).toContain('Закупки');
  });

  it('без права knowledge.edit редактор по прямой ссылке — 403', async () => {
    await open('/knowledge/new', 'R9');
    await waitFor(() => text().includes('403'));
    expect(button('Опубликовать')).toBeUndefined();
  });
});
