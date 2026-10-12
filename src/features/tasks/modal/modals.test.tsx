import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { addDays, dayKind, todayInBishkek } from '@/shared/lib/workDays';
import { resetTasksMock } from '../api';
import { createMockTasks } from '../mock';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let router: ReturnType<typeof createMemoryRouter>;
const page = () => document.body.textContent ?? '';
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${page().slice(0, 300)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};

const setValue = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const button = (text: string, scope: ParentNode = document) =>
  [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === text,
  );

const translationId = () =>
  createMockTasks().department.find((t) => t.title.startsWith('Перевод устава'))?.id;

async function render(path: string) {
  router = createMemoryRouter(routes, { initialEntries: [path] });
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

beforeEach(async () => {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R1')));
  resetTasksMock();
  await i18n.changeLanguage('ru');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
});

describe('карточка задачи', () => {
  it('открывается кликом, адрес получает ?task=', async () => {
    await render('/tasks');
    await waitFor(() => page().includes('Перевод устава на кыргызский язык'));
    const open = button('Перевод устава на кыргызский язык');
    await act(async () => open?.click());
    await waitFor(() => dialog()?.textContent?.includes('Подзадачи') ?? false);
    expect(router.state.location.search).toContain('task=');
  });

  it('прямая ссылка открывает задачу; счётчики совпадают с содержимым', async () => {
    await render(`/tasks?task=${translationId()}`);
    await waitFor(() => dialog()?.textContent?.includes('Юридическая сверка терминов') ?? false);
    const d = dialog() as HTMLElement;
    expect(d.textContent).toContain('2 из 4');
    // Обсуждение «5»: видно 2, остальные — по кнопке
    expect(d.querySelectorAll('li time').length).toBeGreaterThan(0);
    expect(d.textContent).toContain('Показать ещё 3');
    await act(async () => button('Показать ещё 3', d)?.click());
    expect(d.textContent).not.toContain('Показать ещё');
    expect(d.textContent).toContain('Срок переносили 2 раза');
    expect(d.textContent).toContain('Журнал действий неизменяем');
  });

  it('отметка подзадачи меняет счётчик и добавляет запись в журнал', async () => {
    await render(`/tasks?task=${translationId()}`);
    await waitFor(() => dialog()?.textContent?.includes('Утверждение на Исполкоме') ?? false);
    const box = [
      ...(dialog()?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? []),
    ][2];
    await act(async () => box.click());
    await waitFor(() => dialog()?.textContent?.includes('3 из 4') ?? false);
    expect(dialog()?.textContent).toContain('Подзадача выполнена: «Юридическая сверка терминов»');
  });

  it('несуществующая задача — «Задача не найдена»', async () => {
    await render('/tasks?task=no-such-task');
    await waitFor(() => dialog()?.textContent?.includes('Задача не найдена') ?? false);
  });
});

describe('новая задача', () => {
  const openForm = async () => {
    await render('/tasks');
    await waitFor(() => !!button('Новая задача'));
    await act(async () => button('Новая задача')?.click());
    await waitFor(() => !!dialog()?.querySelector('#nt-title'));
    return dialog() as HTMLElement;
  };

  it('без названия и исполнителя — ошибки', async () => {
    const d = await openForm();
    await act(async () => button('Создать задачу', d)?.click());
    await waitFor(() => d.textContent?.includes('Введите название') ?? false);
    expect(d.textContent).toContain('Выберите исполнителя');
  });

  it('срок в выходной или праздник не принимается', async () => {
    const d = await openForm();
    const due = d.querySelector<HTMLInputElement>('#nt-due') as HTMLInputElement;
    let weekend = todayInBishkek();
    while (dayKind(weekend).kind !== 'weekend') weekend = addDays(weekend, 1);
    await setValue(d.querySelector('#nt-title') as HTMLInputElement, 'Тестовая задача');
    await setValue(due, weekend);
    await act(async () => button('Создать задачу', d)?.click());
    await waitFor(() => d.textContent?.includes('Срок выпадает на выходной') ?? false);
    await setValue(due, '2026-12-31' < todayInBishkek() ? '2027-01-07' : '2026-08-31');
    await act(async () => button('Создать задачу', d)?.click());
    await waitFor(() =>
      /Срок выпадает на нерабочий день|Срок не может быть в прошлом/.test(d.textContent ?? ''),
    );
  });

  it('похожие задачи — предупреждение, не блокирует', async () => {
    const d = await openForm();
    await setValue(
      d.querySelector('#nt-title') as HTMLInputElement,
      'Антидопинговый план на 2028 год',
    );
    await waitFor(() => d.textContent?.includes('Похожие задачи уже есть') ?? false);
    expect(d.textContent).toContain('«Антидопинговый план на 2027 год» · на проверке');
  });
});
