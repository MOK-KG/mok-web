import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import type { RoleCode } from '@/shared/config/permissions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const text = () => container.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timeout');
    await act(async () => new Promise((r) => setTimeout(r, 20)));
  }
};

async function open(role: RoleCode) {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
  await i18n.changeLanguage('ru');
  const router = createMemoryRouter(routes, { initialEntries: ['/absences'] });
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

describe('отпуск и командировки: право оформлять своё отсутствие', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('сотрудник видит кнопку «Оформить отсутствие»', async () => {
    await open('R5');
    await waitFor(() => text().includes('Оформить отсутствие'));
  });

  it('наблюдатель кнопки не видит', async () => {
    await open('R9');
    await waitFor(() => text().includes('Все сотрудники'));
    expect(text()).not.toContain('Оформить отсутствие');
  });
});
