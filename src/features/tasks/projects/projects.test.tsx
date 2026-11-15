import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { resetTasksMock } from '@/features/tasks/api';
import type { RoleCode } from '@/shared/config/permissions';

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

async function open(url: string, role: RoleCode = 'R3') {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
  resetTasksMock();
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
}

const section = (name: string) =>
  document.querySelector(`section[aria-label="${name}"]`)?.textContent ?? '';

const button = (name: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);

function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function createProject(name: string) {
  const input = document.querySelector('input[aria-label="Название проекта"]') as HTMLInputElement;
  await act(async () => setValue(input, name));
  const form = document.querySelector('form[aria-label="Новый проект"]') as HTMLFormElement;
  await act(async () => form.requestSubmit());
}

describe('проекты', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('список активных проектов со счётчиком задач', async () => {
    await open('/tasks/projects');
    await waitFor(() => section('Активные').includes('Антидопинг 2026'));
    expect(section('Активные')).toContain('Аккредитация');
    expect(section('Активные')).toMatch(/\d+ задач/);
  });

  it('новый проект появляется в списке', async () => {
    await open('/tasks/projects');
    await waitFor(() => section('Активные').includes('Антидопинг 2026'));
    await createProject('Олимпийская неделя');
    await waitFor(() => section('Активные').includes('Олимпийская неделя'));
    expect(
      (document.querySelector('input[aria-label="Название проекта"]') as HTMLInputElement).value,
    ).toBe('');
  });

  it('проект с тем же названием не создаётся', async () => {
    await open('/tasks/projects');
    await waitFor(() => section('Активные').includes('Аккредитация'));
    await createProject('аккредитация');
    await waitFor(() => text().includes('Такой проект уже есть'));
  });

  it('пустое название — ошибка без запроса', async () => {
    await open('/tasks/projects');
    await waitFor(() => section('Активные').includes('Аккредитация'));
    await createProject('   ');
    await waitFor(() => text().includes('Укажите название'));
  });

  it('в архив и обратно', async () => {
    await open('/tasks/projects');
    await waitFor(() => section('Активные').includes('Гранты и заявки'));
    const row = [...document.querySelectorAll('li')].find((li) =>
      li.textContent?.includes('Гранты и заявки'),
    ) as HTMLLIElement;
    const archive = [...row.querySelectorAll('button')].find(
      (b) => b.textContent === 'В архив',
    ) as HTMLButtonElement;
    await act(async () => archive.click());
    await waitFor(() => section('В архиве').includes('Гранты и заявки'));
    expect(section('Активные')).not.toContain('Гранты и заявки');

    await act(async () => button('Вернуть')?.click());
    await waitFor(() => section('Активные').includes('Гранты и заявки'));
    expect(document.querySelector('section[aria-label="В архиве"]')).toBeNull();
  });

  it('переименование', async () => {
    await open('/tasks/projects');
    await waitFor(() => section('Активные').includes('Международные связи'));
    const edit = document.querySelector(
      'button[aria-label="Переименовать: Международные связи"]',
    ) as HTMLButtonElement;
    await act(async () => edit.click());
    const input = document.querySelector('input[aria-label="Переименовать"]') as HTMLInputElement;
    await act(async () => setValue(input, 'Международный отдел'));
    await act(async () => button('Сохранить')?.click());
    await waitFor(() => section('Активные').includes('Международный отдел'));
    expect(section('Активные')).not.toContain('Международные связи');
  });

  it('без права назначать задачи — только просмотр', async () => {
    await open('/tasks/projects', 'R5');
    await waitFor(() => section('Активные').includes('Аккредитация'));
    expect(text()).toContain('Менять проекты может генеральный секретарь');
    expect(document.querySelector('form[aria-label="Новый проект"]')).toBeNull();
    expect(button('В архив')).toBeUndefined();
  });

  it('из задач есть переход к проектам', async () => {
    await open('/tasks');
    await waitFor(() => document.querySelector('a[href="/tasks/projects"]') !== null);
  });
});
