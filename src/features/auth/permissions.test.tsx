import { useQuery } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { journalEntries } from '@/features/journal/store';
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

  it('в меню только разделы роли', async () => {
    signInAs('R6');
    await render('/');
    await waitFor(() => text().includes('Документы'));
    expect(text()).not.toContain('Роли и доступ');
  });

  it('прямая ссылка без права — экран 403, адрес не меняется', async () => {
    // Администратор (R1) не работает с делопроизводством (ТЗ, раздел 06)
    signInAs('R1');
    const router = await render('/documents');
    await waitFor(() => text().includes('Нет доступа'));
    expect(text()).toContain('403');
    expect(router.state.location.pathname).toBe('/documents');
    // Попытка — в журнале действий (приёмка 11.1)
    expect(journalEntries().at(-1)).toMatchObject({
      action: 'accessDenied',
      details: '/documents · documents.view',
    });
  });

  it('с правом раздел открывается', async () => {
    signInAs('R6');
    await render('/documents');
    // Делопроизводство (R6) видит входящие и может регистрировать
    await waitFor(() => text().includes('Зарегистрировать входящий'));
    expect(text()).not.toContain('Нет доступа');
  });

  it('смена роли действует сразу, без перезагрузки', async () => {
    signInAs('R1');
    await render('/access');
    await waitFor(() => text().includes('Пригласить'));

    // Администратор сменил роль на бэкенде; пользователь вернулся на вкладку
    mockApi.setRole('R5');
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
    expect(permissions.filter((p) => p.startsWith('journal.'))).toEqual([
      'journal.view',
      'journal.export',
    ]);
  });

  it('выгрузка журнала — только у Генерального секретаря (R3)', () => {
    const exporters = Object.entries(mockRoleMatrix)
      .filter(([, list]) => list.includes('journal.export'))
      .map(([role]) => role);
    expect(exporters).toEqual(['R3']);
  });

  it('Президент (R2) и Наблюдатель (R9) — только чтение', () => {
    const writes = /\.(create|edit|assign|archive|register|resolve|annul|manage|deactivate)$/;
    for (const role of ['R2', 'R9'] as const) {
      expect(mockRoleMatrix[role].filter((p) => writes.test(p))).toEqual([]);
    }
  });

  it('в заглушке только известные права', () => {
    for (const list of Object.values(mockRoleMatrix)) {
      for (const p of list) expect(permissions).toContain(p);
    }
  });
});
