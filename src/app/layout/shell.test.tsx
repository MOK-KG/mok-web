import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
const text = () => container.textContent ?? '';

const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${text()}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};

const render = async (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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
  return router;
};

describe('каркас приложения', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'active');
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R1')));
    await i18n.changeLanguage('ru');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('заголовок шапки — раздел, подпись — департамент и дата с днём недели', async () => {
    await render('/tasks');
    await waitFor(() => text().includes('Административный департамент'));
    const header = container.querySelector('header');
    expect(header?.querySelector('h1')?.textContent).toBe('Задачи');
    expect(header?.textContent).toMatch(/Административный департамент · [а-я]+, \d{1,2} [а-я]+/);
  });

  it('активный пункт меню отмечен, должность пользователя видна', async () => {
    await render('/tasks');
    await waitFor(() => text().includes('Ген. секретарь'));
    const active = container.querySelector('nav a[aria-current="page"]');
    expect(active?.textContent).toContain('Задачи');
  });

  it('меню сворачивается: названия скрыты, остаются иконки с подписью для чтения с экрана', async () => {
    await render('/');
    await waitFor(() => text().includes('Свернуть'));
    const toggle = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Свернуть'),
    );
    act(() => toggle?.click());
    expect(text()).not.toContain('Свернуть');
    expect(container.querySelector('nav a[aria-label="Задачи"]')).not.toBeNull();
    expect(localStorage.getItem('nok.sidebarCollapsed')).toBe('1');
  });
});
