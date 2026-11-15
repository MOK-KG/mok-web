import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { sessionsServer } from './testing/server';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
const text = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${text().slice(0, 500)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};
const buttons = (label: string) =>
  [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === label);
const click = (el: Element | undefined) =>
  act(async () => (el as HTMLElement | undefined)?.click());

async function open() {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R5')));
  await i18n.changeLanguage('ru');
  const router = createMemoryRouter(routes, { initialEntries: ['/profile'] });
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

describe('профиль: активные сессии и уведомления в браузере', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('список сессий: текущая первой, без кнопки «Завершить»; неизвестное устройство', async () => {
    await open();
    await waitFor(() => text().includes('3 сессии'));
    expect(text()).toContain('Chrome · macOS');
    expect(text()).toContain('это устройство');
    expect(text()).toContain('НОК КР · iPhone');
    expect(text()).toContain('Неизвестное устройство');
    // Кнопок «Завершить» — по одной на чужие сессии (2), у текущей нет
    expect(buttons('Завершить')).toHaveLength(2);
  });

  it('завершить одну сессию и все другие (с подтверждением)', async () => {
    await open();
    await waitFor(() => buttons('Завершить').length === 2);
    await click(
      document.querySelector('button[aria-label="Завершить: НОК КР · iPhone"]') ?? undefined,
    );
    await waitFor(() => !text().includes('НОК КР · iPhone'));
    expect(sessionsServer.sessions.map((s) => s.id)).toEqual(['1', '3']);
    expect(text()).toContain('2 сессии');

    await click(buttons('Завершить все другие сессии')[0]);
    expect(text()).toContain('Завершить 1 другую сессию?');
    await click(buttons('Завершить все другие сессии')[0]);
    await waitFor(() => text().includes('1 сессия'));
    expect(text()).toContain('Другие сессии завершены');
    expect(sessionsServer.sessions.map((s) => s.id)).toEqual(['1']);
    expect(buttons('Завершить')).toHaveLength(0);
  });

  it('браузер без Push API: переключатель выключен, объяснение почему', async () => {
    await open();
    await waitFor(() => text().includes('Этот браузер не поддерживает уведомления'));
    const toggle = [...document.querySelectorAll<HTMLInputElement>('input[role="switch"]')].find(
      (i) => i.closest('label')?.textContent?.includes('Уведомления в браузере'),
    );
    expect(toggle?.disabled).toBe(true);
  });
});
