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
import { staffServer } from './testing/server';

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

  it('ждёт роль: первым в списке, назначение роли через окно открывает доступ', async () => {
    await open('/access');
    await waitFor(() => !!container.querySelector('tbody tr'));
    const first = container.querySelector('tbody tr') as HTMLElement;
    expect(first.textContent).toContain('Бектур Сатыбалдиев');
    expect(first.textContent).toContain('Роль не назначена');
    expect(first.textContent).toContain('Ждёт роль');

    await act(async () => (first.querySelector('button') as HTMLButtonElement).click());
    await waitFor(() => text().includes('роль ещё не назначена'));
    await pickRole('R5');
    await waitFor(() => !!dialog());
    expect(dialog()?.textContent).toContain('Назначить роль?');
    expect(dialog()?.textContent).toContain(
      'Б. Сатыбалдиев получит роль R5 Сотрудник департамента',
    );
    await act(async () => button('Назначить роль', dialog() as HTMLElement)?.click());
    await waitFor(() => !dialog());
    await waitFor(() => !text().includes('роль ещё не назначена'));
    expect(await row('s-bs')).toMatchObject({ status: 'active', role: 'R5' });
  });

  it('сессии: список устройств, «Завершить» с подтверждением', async () => {
    await open('/access?user=s-nb');
    await waitFor(() => text().includes('Chrome · macOS'));
    await act(async () =>
      document
        .querySelector<HTMLButtonElement>('button[aria-label="Завершить: Chrome · macOS"]')
        ?.click(),
    );
    await waitFor(() => !!dialog());
    expect(dialog()?.textContent).toContain('Завершить сессию?');
    await act(async () => button('Завершить', dialog() as HTMLElement)?.click());
    await waitFor(() => text().includes('Открытых сессий нет'));
    expect((await row('s-nb'))?.sessions).toBe(0);
  });

  it('сессии: без API на сервере — число устройств и пометка, а не ошибка', async () => {
    const handle = staffServer.handle;
    vi.spyOn(staffServer, 'handle').mockImplementation((method, path, body) =>
      path.endsWith('/sessions')
        ? { status: 404, body: { code: 'not_found' } }
        : handle(method, path, body),
    );
    await open('/access?user=s-nb');
    await waitFor(() => text().includes('Список устройств появится после обновления сервера'));
    expect(text()).not.toContain('Не удалось');
  });

  it('матрица прав: 9 ролей, у R1 и R3 есть «Назначать роли», у R5 — нет', async () => {
    await open('/access/roles');
    await waitFor(() => !!document.querySelector('td[aria-label^="R1 · Назначать роли"]'));
    const cell = (code: string) =>
      document
        .querySelector(`td[aria-label^="${code} · Назначать роли"]`)
        ?.getAttribute('aria-label');
    expect(cell('R1')).toMatch(/\+$/);
    expect(cell('R3')).toMatch(/\+$/);
    expect(cell('R5')).toMatch(/—$/);
    expect(document.querySelectorAll('thead th')).toHaveLength(10);
  });

  it('матрица прав: без API — понятная пометка', async () => {
    const handle = staffServer.handle;
    vi.spyOn(staffServer, 'handle').mockImplementation((method, path, body) =>
      path === '/staff/roles'
        ? { status: 404, body: { code: 'not_found' } }
        : handle(method, path, body),
    );
    await open('/access/roles');
    await waitFor(() => text().includes('Матрица прав появится после обновления сервера'));
  });

  it('приглашение на вакансию из меню «…»: окно с должностью, вакансия закрывается', async () => {
    await open('/access');
    await waitFor(() => !!button('Показать все 18'));
    await act(async () => button('Показать все 18')?.click());
    await waitFor(() => !!document.querySelector('button[aria-label^="Действия: Юрист"]'));
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>('button[aria-label^="Действия: Юрист"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await waitFor(() => !!document.querySelector('[role="menuitem"]'));
    const invite = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (i) => i.textContent === 'Пригласить на вакансию',
    );
    await act(async () => invite?.click());
    await waitFor(() => text().includes('Пригласить на вакансию «'));
    const form = document.querySelector('[role="dialog"] form') as HTMLFormElement;
    const [name, email] = [...form.querySelectorAll<HTMLInputElement>('input')];
    await act(async () => {
      type(name, 'Асель Орозова');
      type(email, 'a.orozova@olympic.kg');
    });
    await act(async () => form.requestSubmit());
    await waitFor(() => text().includes('Приглашение отправлено на a.orozova@olympic.kg'));
    expect((await fetchStaff(ME)).some((r) => r.status === 'vacancy')).toBe(false);
  });

  it('фильтр через меню: «Ждёт роль» — строк столько же, сколько в счётчике', async () => {
    await open('/access');
    await waitFor(() => !!button('Фильтр'));
    await act(async () => {
      button('Фильтр')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    });
    await waitFor(() => !!document.querySelector('[role="menuitemcheckbox"]'));
    const pending = [...document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')].find(
      (i) => i.textContent?.startsWith('Ждёт роль'),
    ) as HTMLElement;
    const count = Number(pending.textContent?.replace('Ждёт роль', ''));
    await act(async () => pending.click());
    await waitFor(() => text().includes(`${count} из 18`));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(count);
  });

  it('нельзя остаться без тех, кто назначает роли — понятная ошибка', async () => {
    await open('/access?user=s-at');
    await waitFor(() => !!document.querySelector('button[aria-label="Роль"]'));
    await pickRole('R5');
    await waitFor(() => !!dialog());
    await act(async () => button('Сменить роль', dialog() as HTMLElement)?.click());
    await waitFor(() => !dialog());
    await waitFor(() => !!document.querySelector('button[aria-label="Роль"]'));
    expect((await row('s-at'))?.role).toBe('R5');
    act(() => root.unmount());
    container.remove();

    await open('/access?user=s-ad');
    await waitFor(() => !!document.querySelector('button[aria-label="Роль"]'));
    await pickRole('R9');
    await waitFor(() => !!dialog());
    await act(async () => button('Сменить роль', dialog() as HTMLElement)?.click());
    await waitFor(() => text().includes('Не останется никого, кто может назначать роли'));
  });
});
