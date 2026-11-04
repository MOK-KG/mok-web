import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { ApiError } from '@/shared/api/errors';
import type { RoleCode } from '@/shared/config/permissions';
import { addDays } from '@/shared/lib/workDays';
import {
  fetchArticle,
  fetchDocumentArticles,
  fetchKnowledge,
  saveArticle,
  searchKnowledge,
  toPerson,
  uploadAttachment,
} from './api';
import { parseDocumentNumber } from './DocumentDialog';
import { blocksToMarkdown, markdownToBlocks } from './markdown';
import { freshnessOf, matchesQuery, queryStems } from './search';
import { createMockKnowledge } from './testing/fixtures';
import { installKnowledgeServer, type KnowledgeServer } from './testing/server';
import type { KbBlock } from './types';

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

  it('документ: тип и корреспондент из номера', () => {
    expect(parseDocumentNumber('Вх. №2026-0884 · Минюст')).toEqual({
      kind: 'incoming',
      number: '№2026-0884',
      party: 'Минюст',
    });
    expect(parseDocumentNumber('Приказ №58 · НОК КР').kind).toBe('order');
  });

  it('автор: короткое имя и постоянный цвет; без автора — прочерк', () => {
    const person = { id: '7', email: 'n.bakirov@olympic.kg', name: 'Нурлан Бакиров' };
    expect(toPerson(person)).toMatchObject({
      id: '7',
      name: 'Нурлан Бакиров',
      short: 'Н. Бакиров',
    });
    expect(toPerson(person).tone).toBe(toPerson({ ...person }).tone);
    expect(toPerson(null).name).toBe('—');
  });
});

describe('текст статьи: блоки ↔ markdown', () => {
  const blocks: KbBlock[] = [
    { kind: 'paragraph', text: 'Перевод заказывают заранее.\nОригинал — в деле.' },
    { kind: 'heading', id: 'h-1', text: 'Сроки' },
    { kind: 'list', items: ['Минюст — 5 дней', 'МОК — 10 дней'] },
    { kind: 'note', title: 'Важно', text: 'Подшивать перевод вместо оригинала нельзя.' },
    { kind: 'heading', id: 'h-2', text: 'Кто отвечает' },
    { kind: 'note', title: '', text: 'Без заголовка' },
  ];

  it('markdown для поиска и ссылок на бэкенде', () => {
    expect(blocksToMarkdown(blocks)).toBe(
      [
        'Перевод заказывают заранее.\nОригинал — в деле.',
        '## Сроки',
        '- Минюст — 5 дней\n- МОК — 10 дней',
        '> **Важно**\n> Подшивать перевод вместо оригинала нельзя.',
        '## Кто отвечает',
        '> Без заголовка',
      ].join('\n\n'),
    );
  });

  it('туда и обратно без потерь; якоря заголовков — по порядку', () => {
    expect(markdownToBlocks(blocksToMarkdown(blocks))).toEqual(blocks);
  });

  it('markdown из импорта: заголовок без пустой строки, нумерованный список', () => {
    expect(markdownToBlocks('# Устав\nТекст устава\n\n1. Первое\n2. Второе')).toEqual([
      { kind: 'heading', id: 'h-1', text: 'Устав' },
      { kind: 'paragraph', text: 'Текст устава' },
      { kind: 'list', items: ['Первое', 'Второе'] },
    ]);
  });

  it('статьи из тестовых данных переживают сохранение в markdown', () => {
    for (const a of createMockKnowledge(TODAY).articles) {
      const ids = a.body.filter((b) => b.kind === 'heading').map((_, i) => `h-${i + 1}`);
      const again = markdownToBlocks(blocksToMarkdown(a.body));
      expect(
        again.filter((b) => b.kind === 'heading').map((b) => b.kind === 'heading' && b.id),
      ).toEqual(ids);
      expect(again.length).toBe(a.body.length);
    }
  });
});

describe('база знаний через API', () => {
  let server: KnowledgeServer;
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R1')));
    server = installKnowledgeServer({ today: TODAY });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('закрытый раздел: статьи не приходят, не ищутся и не считаются, по ссылке — 403', async () => {
    const { sections, articles } = await fetchKnowledge();
    expect(sections.find((s) => s.id === 'legal')).toMatchObject({ accessible: false, count: 9 });
    expect(articles.some((a) => a.sectionId === 'legal')).toBe(false);
    // «Все статьи» = сумма открытых разделов
    const open = sections.filter((s) => s.accessible).reduce((n, s) => n + s.count, 0);
    expect(articles.length).toBe(open);
    expect((await searchKnowledge(QUERY)).ids).toHaveLength(3);

    const legal = server.articles.find((a) => a.sectionId === 'legal');
    await expect(fetchArticle(legal?.id ?? '')).rejects.toMatchObject({ status: 403 });
    await expect(fetchArticle('kb-404')).rejects.toBeInstanceOf(ApiError);
  });

  it('статья приходит блоками; версии — со своим текстом', async () => {
    const article = await fetchArticle('kb-1');
    expect(article.body.filter((b) => b.kind === 'heading')).toHaveLength(2);
    expect(article.versions.map((v) => v.number)).toEqual([4, 3, 2]);
    expect(article.versions[2].body).not.toEqual(article.versions[0].body);
    expect(article.attachments[0]).toMatchObject({
      name: 'Глоссарий терминов МОК на трёх языках',
      ext: 'docx',
    });
  });

  it('сохранение: новая версия, новые файлы загружаются, убранные — в архив', async () => {
    const article = await fetchArticle('kb-1');
    const file = new File(['%PDF-1.4'], 'Положение о закупках.PDF', { type: 'application/pdf' });
    const added = uploadAttachment(file);
    expect(added).toMatchObject({ name: 'Положение о закупках', ext: 'pdf', size: 8 });

    const saved = await saveArticle(article, {
      ...article,
      body: [{ kind: 'paragraph', text: 'Коротко' }],
      attachments: [...article.attachments.slice(1), added],
      change: 'сокращено',
    });
    expect(saved.version).toBe(5);
    expect(saved.versions[0]).toMatchObject({ number: 5, change: 'сокращено' });
    expect(saved.versions[0].body).toEqual([{ kind: 'paragraph', text: 'Коротко' }]);
    expect(saved.attachments.map((a) => `${a.name}.${a.ext}`)).toEqual([
      'Форма служебной записки на перевод.docx',
      'Договор с бюро переводов 2026.pdf',
      'Положение о закупках.pdf',
    ]);
    expect(server.archived.has(article.attachments[0].id)).toBe(true);
    expect([...server.files.values()]).toEqual([file]);
  });

  it('статьи с документом — только из открытых разделов', async () => {
    const doc = (await fetchArticle('kb-1')).relatedDocuments[0];
    expect((await fetchDocumentArticles(doc)).map((a) => a.id)).toContain('kb-1');
    const records = server.sections.find((s) => s.id === 'records');
    if (records) records.openTo = ['R6'];
    expect((await fetchDocumentArticles(doc)).map((a) => a.id)).not.toContain('kb-1');
  });
});

let root: Root;
let server: KnowledgeServer;
let container: HTMLDivElement;
const text = () => container.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${text().slice(0, 400)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};

async function open(url: string, role: RoleCode = 'R3') {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
  server = installKnowledgeServer();
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
    vi.unstubAllGlobals();
  });

  it('поиск в разделе: счётчики совпадают с подсвеченными статьями', async () => {
    await open(`/knowledge?section=records&q=${encodeURIComponent(QUERY)}`);
    await waitFor(() => text().includes('Найдено'));
    expect(text()).toContain('55 статей в 6 разделах');
    expect(text()).toContain(`Найдено 3 статьи по запросу «${QUERY}»`);
    expect(text()).toContain('14 статей · 3 найдено');
    // Совпадения в закрытом разделе не показываются и не считаются (приёмка 11.3)
    expect(text()).not.toMatch(/Ещё \d+ стат/);

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
    vi.unstubAllGlobals();
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
    expect(server.articles.filter((a) => a.sectionId === 'records')).toHaveLength(15);
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
    // Якоря заголовков — по порядку, содержание по-прежнему ведёт к ним
    expect(container.querySelector('#h-1')).not.toBeNull();
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
