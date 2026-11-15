import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { resetTasksMock } from '@/features/tasks/api';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let router: ReturnType<typeof createMemoryRouter>;
const text = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${text().slice(0, 400)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};

function screenWidth(narrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('max-width') ? narrow : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

async function open(narrow = false) {
  screenWidth(narrow);
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  localStorage.removeItem('nok.tasksView');
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R3')));
  resetTasksMock();
  await i18n.changeLanguage('ru');
  router = createMemoryRouter(routes, { initialEntries: ['/tasks'] });
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

const list = () => document.querySelector('section[aria-label="Список"]');
const rows = () => [...(list()?.querySelectorAll('li') ?? [])];
const tab = (name: string) =>
  [...(list()?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])].find((b) =>
    b.textContent?.startsWith(name),
  );

describe('список задач', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('на широком экране — доска, переключатель открывает список', async () => {
    await open();
    await waitFor(() => !!document.querySelector('button[aria-label="Список"]'));
    expect(list()).toBeNull();
    await act(async () =>
      document.querySelector<HTMLButtonElement>('button[aria-label="Список"]')?.click(),
    );
    await waitFor(() => rows().length > 0);
    expect(localStorage.getItem('nok.tasksView')).toBe('list');
  });

  it('на узком экране список включается сам', async () => {
    await open(true);
    await waitFor(() => rows().length > 0);
  });

  it('быстрый фильтр: строк столько же, сколько в счётчике', async () => {
    await open(true);
    await waitFor(() => rows().length > 0);
    const overdue = tab('Просрочено') as HTMLButtonElement;
    const count = Number(overdue.querySelector('span')?.textContent);
    await act(async () => overdue.click());
    expect(rows()).toHaveLength(count);
    const all = Number(tab('Все')?.querySelector('span')?.textContent);
    await act(async () => tab('Все')?.click());
    expect(rows()).toHaveLength(all);
  });

  it('просроченные — наверху списка', async () => {
    await open(true);
    await waitFor(() => rows().length > 0);
    const overdue = Number(tab('Просрочено')?.querySelector('span')?.textContent);
    if (overdue > 0) expect(rows()[0].textContent).toMatch(/Просрочено/);
  });

  it('строка открывает задачу', async () => {
    await open(true);
    await waitFor(() => rows().length > 0);
    await act(async () => rows()[0].querySelector('button')?.click());
    await waitFor(() => router.state.location.search.includes('task='));
  });
});
