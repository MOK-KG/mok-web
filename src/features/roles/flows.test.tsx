import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { journalServer } from '@/features/journal/testing/server';
import type { RoleCode } from '@/shared/config/permissions';
import { fetchStaff } from './api';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = 'u-ad';
let root: Root;
let container: HTMLDivElement;
const text = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${text().slice(0, 500)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};
const button = (label: string, scope: ParentNode = document) =>
  [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === label,
  );
const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const row = async (id: string) => (await fetchStaff(ME)).find((r) => r.id === id);

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

async function open(url: string, role: RoleCode = 'R1') {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
  await i18n.changeLanguage('ru');
  const router = createMemoryRouter(routes, { initialEntries: [url] });
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
}

async function pickRole(code: RoleCode) {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Роль"]');
  const key = async (target: Element | null, k: string) => {
    await act(async () => {
      target?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    });
    await act(() => new Promise((r) => setTimeout(r, 30)));
  };
  await act(async () => trigger?.focus());
  await key(trigger, 'ArrowDown');
  await waitFor(() => document.querySelectorAll('[role="option"]').length > 0);
  await act(() => new Promise((r) => setTimeout(r, 20)));
  for (let i = 0; i < 12 && !document.activeElement?.textContent?.startsWith(code); i++) {
    await key(document.activeElement, 'ArrowDown');
  }
  for (let i = 0; i < 12 && !document.activeElement?.textContent?.startsWith(code); i++) {
    await key(document.activeElement, 'ArrowUp');
  }
  const picked = document.activeElement?.textContent?.slice(0, 2);
  await key(document.activeElement, 'Enter');
  return picked;
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('роли и доступ: сценарии', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('смена роли: окно подтверждения → «Сменить роль» → роль изменилась, запись в журнале', async () => {
    await open('/access?user=s-nb');
    await waitFor(() => !!document.querySelector('button[aria-label="Роль"]'));
    expect(await pickRole('R4')).toBe('R4');
    await waitFor(() => !!dialog());
    expect(dialog()?.textContent).toContain('Н. Бакиров: R5 Сотрудник департамента → R4');
    expect((await row('s-nb'))?.role).toBe('R5');

    await act(async () => button('Сменить роль', dialog() as HTMLElement)?.click());
    await waitFor(() => !dialog());
    await waitFor(() => text().includes('действует сразу'));
    expect((await row('s-nb'))?.role).toBe('R4');
    expect(journalServer.entries.at(-1)?.action).toBe('roleChanged');
  });

  it('смена роли: «Отмена» — ничего не меняется', async () => {
    await open('/access?user=s-nb');
    await waitFor(() => !!document.querySelector('button[aria-label="Роль"]'));
    const before = journalServer.entries.length;
    await pickRole('R9');
    await waitFor(() => !!dialog());
    await act(async () => button('Отмена', dialog() as HTMLElement)?.click());
    await waitFor(() => !dialog());
    expect((await row('s-nb'))?.role).toBe('R5');
    expect(journalServer.entries.length).toBe(before);
  });

  it('своя роль: окно предупреждает, что разделы могут закрыться', async () => {
    await open('/access?user=s-ad');
    await waitFor(() => !!document.querySelector('button[aria-label="Роль"]'));
    await pickRole('R9');
    await waitFor(() => !!dialog());
    expect(dialog()?.textContent).toContain('Это ваша роль');
    await act(async () => button('Отмена', dialog() as HTMLElement)?.click());
  });

  it('увольнение: «Отмена» возвращает к кнопке, сотрудник остаётся активным', async () => {
    await open('/access?user=s-nb');
    await waitFor(() => !!button('Деактивировать'));
    await act(async () => button('Деактивировать')?.click());
    await waitFor(() => !!button('Да, деактивировать Н. Бакиров'));
    await act(async () => button('Отмена')?.click());
    await waitFor(() => !!button('Деактивировать'));
    expect((await row('s-nb'))?.status).toBe('active');
  });

  it('приглашение: ошибки формы, повтор адреса, затем успех — статус «Приглашён»', async () => {
    await open('/access');
    await waitFor(() => !!button('Пригласить'));
    await act(async () => button('Пригласить')?.click());
    await waitFor(() => !!document.querySelector('[role="dialog"] form'));
    const form = document.querySelector('[role="dialog"] form') as HTMLFormElement;
    const [name, email, position, department] = [
      ...form.querySelectorAll<HTMLInputElement>('input'),
    ];

    await act(async () => {
      type(name, 'Мээрим');
      type(email, 'meerim@gmail.com');
    });
    await act(async () => form.requestSubmit());
    await waitFor(() => text().includes('Укажите имя и фамилию'));
    expect(text()).toContain('Только адрес @olympic.kg');

    await act(async () => {
      type(name, 'Мээрим Эсенова');
      type(email, 'm.esenova@olympic.kg');
      type(position, 'Специалист');
      type(department, 'Медицинский');
    });
    await act(async () => form.requestSubmit());
    await waitFor(() => text().includes('уже есть'));

    await act(async () => type(email, 'e.sultanova@olympic.kg'));
    await act(async () => form.requestSubmit());
    await waitFor(() => text().includes('Приглашение отправлено на e.sultanova@olympic.kg'));
    expect((await fetchStaff(ME)).find((r) => r.email === 'e.sultanova@olympic.kg')?.status).toBe(
      'invited',
    );
  });

  it('копирование почты из меню «…» — тост', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await open('/access');
    await waitFor(() => !!document.querySelector('button[aria-label^="Действия: Нурлан Бакиров"]'));
    const trigger = document.querySelector<HTMLButtonElement>(
      'button[aria-label^="Действия: Нурлан Бакиров"]',
    );
    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await waitFor(() => !!document.querySelector('[role="menuitem"]'));
    const copy = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (i) => i.textContent === 'Скопировать почту',
    );
    await act(async () => copy?.click());
    await waitFor(() => text().includes('Почта скопирована'));
    expect(writeText).toHaveBeenCalledWith('n.bakirov@olympic.kg');
  });
});
