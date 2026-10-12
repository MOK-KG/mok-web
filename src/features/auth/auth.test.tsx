import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${container.textContent}`);
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

const click = (text: string) => {
  const el = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  if (!el) throw new Error(`Нет кнопки «${text}»`);
  act(() => el.click());
};

describe('авторизация', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await i18n.changeLanguage('ru');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('без сессии прямая ссылка ведёт на вход', async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'active');
    const router = await render('/');
    await waitFor(() => router.state.location.pathname === '/login');
    expect(container.textContent).toContain('Вход в систему');
  });

  it('вход с ролью открывает главную', async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'active');
    const router = await render('/login');
    await waitFor(() => container.textContent?.includes('Продолжить с Google') ?? false);
    click('Продолжить с Google');
    await waitFor(() => router.state.location.pathname === '/');
    await waitFor(() => container.textContent?.includes('Айбек Дуйшеев') ?? false);
  });

  it('вход без роли ведёт на «Аккаунт на проверке»', async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'pending');
    const router = await render('/login');
    await waitFor(() => container.textContent?.includes('Продолжить с Google') ?? false);
    click('Продолжить с Google');
    await waitFor(() => router.state.location.pathname === '/pending');
    expect(container.textContent).toContain('Роль ещё не назначена');
  });

  it('чужой домен показывает отказ в доступе', async () => {
    await render('/login?error=forbidden_domain&email=a.duysheyev@gmail.com');
    await waitFor(() => container.textContent?.includes('Доступ запрещён') ?? false);
    expect(container.textContent).toContain('a.duysheyev@gmail.com');
    expect(container.textContent).toContain('Войти с другим аккаунтом');
  });

  it('переключатели темы и языка работают на экране входа', async () => {
    await render('/login');
    await waitFor(() => container.textContent?.includes('Вход в систему') ?? false);

    const light = container.querySelector<HTMLInputElement>('input[name="theme"][value="light"]');
    act(() => light?.click());
    expect(document.documentElement.dataset.theme).toBe('light');

    const en = container.querySelector<HTMLInputElement>('input[name="language"][value="en"]');
    await act(async () => en?.click());
    await waitFor(() => container.textContent?.includes('Sign in') ?? false);
  });
});
