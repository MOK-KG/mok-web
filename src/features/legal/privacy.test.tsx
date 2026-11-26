import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timeout');
    await act(async () => new Promise((r) => setTimeout(r, 20)));
  }
};

async function open(path: string) {
  vi.stubEnv('VITE_AUTH_MOCK', 'guest');
  sessionStorage.clear();
  await i18n.changeLanguage('ru');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  );
  return { container, router, root };
}

describe('политика конфиденциальности', () => {
  it('открывается без входа, все разделы на месте', async () => {
    const { container, router, root } = await open('/privacy');
    await waitFor(() => container.textContent?.includes('Политика конфиденциальности') ?? false);
    expect(router.state.location.pathname).toBe('/privacy');
    expect(container.querySelectorAll('h2')).toHaveLength(11);
    expect(container.textContent).toContain('OpenAI');
    expect(container.textContent).toContain('info@olympic.kg');
    act(() => root.unmount());
    vi.unstubAllEnvs();
  });

  it('на экране входа есть ссылка на политику', async () => {
    const { container, root } = await open('/login');
    await waitFor(() => !!container.querySelector('a[href="/privacy"]'));
    act(() => root.unmount());
    vi.unstubAllEnvs();
  });
});
