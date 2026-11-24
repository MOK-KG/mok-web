import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { resetTasksMock } from '@/features/tasks/api';
import { tasksServer } from '@/features/tasks/testing/server';
import { addDays, nextWorkingDay, todayInBishkek } from '@/shared/lib/workDays';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let router: ReturnType<typeof createMemoryRouter>;
const page = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${page().slice(0, 400)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};

const stat = (label: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>('section[aria-label] a')].find((a) =>
    a.textContent?.startsWith(label),
  );
const statValue = (label: string) => Number(stat(label)?.textContent?.replace(label, '').trim());
const cards = () => document.querySelectorAll('article[aria-label]').length;

beforeEach(async () => {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R3')));
  localStorage.setItem('nok.tasksView', 'board');
  resetTasksMock();
  await i18n.changeLanguage('ru');
  const mine = tasksServer.tasks.find(
    (t) =>
      t.assignee?.name === 'Айбек Дуйшеев' &&
      t.status !== 'done' &&
      !t.archived &&
      t.due !== null &&
      t.due > addDays(todayInBishkek(), 3),
  );
  if (mine) mine.due = nextWorkingDay(addDays(todayInBishkek(), 1));
  router = createMemoryRouter(routes, { initialEntries: ['/'] });
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
  await waitFor(() => Number.isFinite(statValue('Мои задачи')));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe('рабочий стол: число на плитке совпадает с открывшимся списком', () => {
  it.each([
    ['Просрочено', 'due'],
    ['Срок до 2 дней', 'due'],
  ])('«%s» открывает мои задачи с фильтром срока', async (label) => {
    const expected = statValue(label);
    expect(expected).toBeGreaterThan(0);
    await act(async () => stat(label)?.click());
    await waitFor(() => router.state.location.pathname === '/tasks');
    await waitFor(() => page().includes(`${expected} из `) || (expected === 0 && cards() === 0));
    await waitFor(() => cards() === expected);
    expect(router.state.location.search).toBe('');
  });

  it('«Мои задачи» открывает вкладку «Мои»', async () => {
    await act(async () => stat('Мои задачи')?.click());
    await waitFor(() => router.state.location.pathname === '/tasks');
    await waitFor(
      () =>
        document
          .querySelector('[role="tab"][aria-selected="true"]')
          ?.textContent?.startsWith('Мои') ?? false,
    );
  });
});

describe('задача с рабочего стола', () => {
  it('открывается карточкой на месте, без перехода в «Задачи»', async () => {
    const link = await (async () => {
      await waitFor(() => !!document.querySelector('main a[href*="task="]'));
      return document.querySelector<HTMLAnchorElement>('main a[href*="task="]');
    })();
    expect(link?.getAttribute('href')?.startsWith('/?task=')).toBe(true);
    await act(async () => link?.click());
    await waitFor(() => !!document.querySelector('[role="dialog"]'));
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toContain('task=');
    const close = document.querySelector<HTMLButtonElement>(
      '[role="dialog"] button[aria-label="Закрыть"]',
    );
    await act(async () => close?.click());
    await waitFor(() => !document.querySelector('[role="dialog"]'));
    expect(router.state.location.search).toBe('');
  });
});

describe('рабочий стол не запрашивает запрещённое: в журнал не попадают ложные отказы', () => {
  it.each([
    ['R1', /\/api\/tasks\//],
    ['R9', /\/api\/(chat\/|tasks\/mail\/)/],
  ] as const)('%s', async (role, forbidden) => {
    act(() => root.unmount());
    container.remove();
    const urls: string[] = [];
    const previous = globalThis.fetch;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      return previous(input, init);
    });
    sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
    router = createMemoryRouter(routes, { initialEntries: ['/'] });
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
    await waitFor(() => page().includes('Уведомления'));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(urls.filter((u) => forbidden.test(u))).toEqual([]);
  });
});
