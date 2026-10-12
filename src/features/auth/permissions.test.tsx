import { useQuery } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { ApiError } from '@/shared/api/client';
import { mockRoleMatrix, permissions, type RoleCode } from '@/shared/config/permissions';
import { mockApi, mockSessionFor } from './mock';

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

const signInAs = (role: RoleCode) =>
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));

const render = async (path: string, extra?: React.ReactNode) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <AppProviders>
        <RouterProvider router={router} />
        {extra}
      </AppProviders>,
    ),
  );
  return router;
};

describe('права доступа', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'active');
    sessionStorage.clear();
    await i18n.changeLanguage('ru');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('на главной видны только разделы роли', async () => {
    signInAs('R6');
    await render('/');
    await waitFor(() => text().includes('Делопроизводство'));
    expect(text()).not.toContain('Сотрудники');
    expect(text()).not.toContain('Журнал действий');
  });

  it('прямая ссылка без права — экран 403, адрес не меняется', async () => {
    signInAs('R3');
    const router = await render('/documents');
    await waitFor(() => text().includes('Нет доступа'));
    expect(text()).toContain('403');
    expect(router.state.location.pathname).toBe('/documents');
  });

  it('с правом раздел открывается', async () => {
    signInAs('R6');
    await render('/documents');
    await waitFor(() => text().includes('Раздел в разработке'));
    expect(text()).not.toContain('Нет доступа');
  });

  it('смена роли действует сразу, без перезагрузки', async () => {
    signInAs('R1');
    await render('/staff');
    await waitFor(() => text().includes('Сотрудники') && !text().includes('Нет доступа'));

    // Администратор сменил роль на бэкенде; пользователь вернулся на вкладку
    mockApi.setRole('R3');
    await act(async () => window.dispatchEvent(new Event('visibilitychange')));
    await act(async () => window.dispatchEvent(new Event('focus')));
    await waitFor(() => text().includes('Нет доступа'));
  });

  it('ответ 403 от API перечитывает сессию', async () => {
    signInAs('R1');
    const getSession = vi.spyOn(mockApi, 'getSession');
    function Forbidden403() {
      useQuery({
        queryKey: ['probe'],
        queryFn: () => Promise.reject(new ApiError(403, 'Forbidden')),
        retry: false,
      });
      return null;
    }
    await render('/', <Forbidden403 />);
    await waitFor(() => getSession.mock.calls.length >= 2);
    getSession.mockRestore();
  });
});

describe('матрица прав', () => {
  it('прав на удаление журнала, сотрудников, задач и документов нет', () => {
    expect(permissions.filter((p) => /delete|remove/.test(p))).toEqual([]);
    expect(permissions.filter((p) => p.startsWith('journal.'))).toEqual(['journal.view']);
  });

  it('в заглушке только известные права', () => {
    for (const list of Object.values(mockRoleMatrix)) {
      for (const p of list) expect(permissions).toContain(p);
    }
  });
});
