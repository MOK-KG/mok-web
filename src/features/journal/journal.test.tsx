import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import {
  addJournalEntry,
  exportJournal,
  fetchJournal,
  journalEntries,
  journalSettled,
  verifyJournal,
} from './store';
import { installJournalServer, journalServer } from './testing/server';

describe('журнал действий (запросы)', () => {
  it('запись сразу видна локально, сервер связывает её цепочкой', async () => {
    const a = addJournalEntry({
      author: 'К. Асанов',
      action: 'accessDenied',
      details: '/documents · documents.view',
    });
    expect(a.hash).toBe('');
    expect(journalEntries().at(-1)).toMatchObject({
      action: 'accessDenied',
      details: '/documents · documents.view',
    });
    addJournalEntry({
      author: 'К. Асанов',
      action: 'accessDenied',
      details: '/files · files.view',
    });
    await journalSettled();
    const [first, second] = journalEntries();
    expect(first.prevHash).toBe('0'.repeat(64));
    expect(second.prevHash).toBe(first.hash);
    // Автор — из сессии на сервере, а не из запроса
    expect(first.author).toBe('А. Дуйшеев');
    expect(await verifyJournal()).toEqual({ ok: true, checked: 2, brokenAt: null });
  });

  it('действия, которые пишет сервер, с фронта не записываются', async () => {
    addJournalEntry({ author: 'К. Асанов', action: 'mailAccepted', details: 'подмена' });
    await journalSettled();
    expect(journalEntries()).toHaveLength(0);
    expect(journalServer.entries).toHaveLength(0);
  });

  it('изменить журнал через выданные записи нельзя', async () => {
    addJournalEntry({
      author: 'К. Асанов',
      action: 'accessDenied',
      details: '/documents · documents.view',
    });
    const copy = journalEntries() as unknown as { details: string }[];
    copy[0].details = 'подмена';
    expect(journalEntries()[0].details).toBe('/documents · documents.view');
  });

  it('подмена записи на сервере ломает проверку', async () => {
    installJournalServer({ seed: true });
    expect((await verifyJournal()).ok).toBe(true);
    journalServer.entries[1].details = 'подмена';
    expect(await verifyJournal()).toEqual({
      ok: false,
      checked: 2,
      brokenAt: journalServer.entries[1].id,
    });
  });

  it('фильтры: группа, поиск, счётчики групп и «ещё»', async () => {
    installJournalServer({ seed: true });
    const all = await fetchJournal();
    expect(all.items[0].action).toBe('accessDenied'); // новые сверху
    expect(all.counts).toEqual({ access: 1, staff: 2, tasks: 0, documents: 1, journal: 0 });
    const staff = await fetchJournal({ group: 'staff' });
    expect(staff.items.map((e) => e.action)).toEqual(['roleChanged', 'userInvited']);
    expect((await fetchJournal({ q: 'ТОКТОСУНОВА' })).total).toBe(1);
    const byLabel = await fetchJournal({ q: 'отказ', qActions: ['accessDenied'] });
    expect(byLabel.items.map((e) => e.action)).toEqual(['accessDenied']);
    const first = await fetchJournal({ limit: 3 });
    expect([first.items.length, first.total, first.hasMore]).toEqual([3, 4, true]);
    const rest = await fetchJournal({ limit: 3, before: first.items[2].id });
    expect(rest.items.map((e) => e.action)).toEqual(['userInvited']);
  });

  it('выгрузка требует основание и сама попадает в журнал и в файл', async () => {
    installJournalServer({ seed: true });
    await expect(exportJournal('нет')).rejects.toMatchObject({ code: 'reason_required' });
    const csv = await exportJournal('Запрос Ревизионной комиссии');
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(1 + 5);
    expect(lines.at(-1)).toContain('"journalExported"');
    expect(lines.at(-1)).toContain('"Запрос Ревизионной комиссии"');
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
const page = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${page().slice(0, 300)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.trim().startsWith(text),
  );
const rows = () => document.querySelectorAll('tbody tr').length;

describe('журнал действий (экран)', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'active');
    sessionStorage.clear();
    sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R3')));
    installJournalServer({ seed: true });
    await i18n.changeLanguage('ru');
  });

  const render = async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/access/journal'] });
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
    await waitFor(() => rows() === 4);
  };

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('записи и проверка цепочки — с сервера; фильтр по группе', async () => {
    await render();
    await waitFor(() => page().includes('Цепочка цела'));
    expect(page()).toContain('Вх. №2026-0896');
    await act(async () => button('Сотрудники и роли')?.click());
    await waitFor(() => rows() === 2);
    expect(button('Сотрудники и роли')?.textContent).toContain('2');
  });

  it('нарушенная цепочка видна на экране', async () => {
    journalServer.entries[0].details = 'подмена';
    await render();
    await waitFor(() => page().includes('Цепочка нарушена на записи 1'));
  });

  it('поиск по названию действия', async () => {
    await render();
    const input = document.querySelector<HTMLInputElement>(
      'input[placeholder="Кто, что, подробности"]',
    );
    if (!input) throw new Error('нет поиска');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, 'отказ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await waitFor(() => rows() === 1);
    expect(page()).toContain('/access · staff.view');
  });

  it('выгрузка с основанием пишет запись в журнал', async () => {
    await render();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:journal');
    URL.revokeObjectURL = vi.fn();
    await act(async () => button('Выгрузить для проверки')?.click());
    const reason = document.querySelector<HTMLTextAreaElement>('#export-reason');
    if (!reason) throw new Error('нет поля основания');
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setValue?.call(reason, 'Запрос Ревизионной комиссии');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Выгрузить CSV')?.click());
    await waitFor(() => rows() === 5);
    expect(click).toHaveBeenCalled();
    expect(journalServer.entries.at(-1)).toMatchObject({
      action: 'journalExported',
      author: 'А. Дуйшеев',
      reason: 'Запрос Ревизионной комиссии',
    });
  });
});
