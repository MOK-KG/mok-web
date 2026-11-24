import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { chatServer } from '@/features/chat/testing/server';
import { formatIsoDate } from '@/shared/lib/date';
import {
  addDays,
  addWorkingDays,
  dayKind,
  nextWorkingDay,
  todayInBishkek,
} from '@/shared/lib/workDays';
import { createTask, resetTasksMock } from '../api';
import { createMockTasks } from '../mock';
import { tasksServer } from '../testing/server';
import type { Person } from '../types';

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
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R3')));
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

  it('переписка: исходное письмо и ответ, раскрывается по клику', async () => {
    const id = translationId();
    const task = tasksServer.tasks.find((x) => x.id === id);
    if (!task) throw new Error('нет задачи');
    task.letters = [
      {
        id: 'l-1',
        sender: 'МОК · Лозанна',
        address: 'compliance@olympic.org',
        subject: 'Charter translation',
        body: 'Please translate the charter.',
        receivedAt: '2026-11-10T09:00:00+06:00',
        followUp: false,
        attachments: 0,
      },
      {
        id: 'l-2',
        sender: 'МОК · Лозанна',
        address: 'compliance@olympic.org',
        subject: 'Re: Charter translation',
        body: 'Any update on the translation?',
        receivedAt: '2026-11-14T11:30:00+06:00',
        followUp: true,
        attachments: 2,
      },
    ];
    await render(`/tasks?task=${id}`);
    await waitFor(() => dialog()?.textContent?.includes('Переписка · 2 письма') ?? false);
    const d = dialog() as HTMLElement;
    expect(d.textContent).toContain('Исходное');
    expect(d.textContent).toContain('2 вложения');
    expect(d.textContent).toContain('Any update on the translation?');
    expect(d.textContent).not.toContain('Please translate the charter.');
    const first = [...d.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) =>
      b.textContent?.startsWith('Charter translation'),
    );
    await act(async () => first?.click());
    expect(d.textContent).toContain('Please translate the charter.');
    expect(d.textContent).not.toContain('Any update on the translation?');
  });

  it('напоминание: выбор в форме правки уходит на сервер', async () => {
    const id = translationId();
    await render(`/tasks?task=${id}`);
    await waitFor(() => dialog()?.textContent?.includes('Юридическая сверка терминов') ?? false);
    const edit = button('Изменить', dialog() as HTMLElement);
    expect(edit).toBeTruthy();
    await act(async () => edit?.click());
    await waitFor(() => page().includes('Не напоминать'));
    const option = [...document.querySelectorAll<HTMLInputElement>('input[type=radio]')].find(
      (x) => x.closest('label')?.textContent === 'за 3 дня',
    );
    await act(async () => option?.click());
    await act(async () => button('Сохранить')?.click());
    await waitFor(() => tasksServer.tasks.find((x) => x.id === id)?.reminderDays === 3);
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

  it('комментарий с файлом: файл виден до отправки и под комментарием после', async () => {
    await render(`/tasks?task=${translationId()}`);
    await waitFor(() => dialog()?.textContent?.includes('Утверждение на Исполкоме') ?? false);
    const d = dialog() as HTMLElement;
    const input = d.querySelector<HTMLInputElement>('[data-testid="comment-files"]');
    const file = new File(['xlsx'], 'smeta.xlsx');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await act(async () => input?.dispatchEvent(new Event('change', { bubbles: true })));
    expect(d.querySelector('[aria-label="Выбранные файлы"]')?.textContent).toContain('smeta.xlsx');
    const send = d.querySelector<HTMLButtonElement>('button[aria-label="Отправить"]');
    expect(send?.disabled).toBe(false);
    await act(async () => send?.click());
    await waitFor(() => !!d.querySelector('[aria-label="Файлы комментария"]'));
    expect(d.querySelector('[aria-label="Файлы комментария"]')?.textContent).toContain(
      'smeta.xlsx',
    );
    expect(d.querySelector('[aria-label="Выбранные файлы"]')).toBeNull();
  });

  it('«Обсудить в чате»: задача уходит карточкой в выбранный чат, чат открывается', async () => {
    await render(`/tasks?task=${translationId()}`);
    await waitFor(() => dialog()?.textContent?.includes('Утверждение на Исполкоме') ?? false);
    await act(async () => button('Обсудить в чате')?.click());
    const picker = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1);
    await waitFor(() => !!picker()?.querySelector('li button'));
    expect(picker()?.textContent).toContain('Обсудить задачу в чате');
    const first = picker()?.querySelector<HTMLButtonElement>('li button');
    expect(first?.textContent).toContain('Канал департамента');
    await act(async () => first?.click());
    await waitFor(() => router.state.location.pathname === '/chat');
    const chatId = new URLSearchParams(router.state.location.search).get('c');
    const sent = chatServer?.store.messages.filter((m) => m.chatId === chatId).at(-1);
    expect(sent?.kind).toBe('task');
    expect(sent?.task?.id).toBe(translationId());
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

  it('календарь срока: выходные, праздники и прошлое выбрать нельзя', async () => {
    const d = await openForm();
    await act(async () => (d.querySelector('#nt-due') as HTMLButtonElement).click());
    await waitFor(() => !!document.querySelector('[data-date]'));
    const day = (date: string) =>
      document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
    const showMonthOf = async (date: string) => {
      for (let i = 0; i < 3 && !day(date); i++) {
        await act(async () =>
          document.querySelector<HTMLButtonElement>('[aria-label="Следующий месяц"]')?.click(),
        );
      }
    };

    let weekend = todayInBishkek();
    while (dayKind(weekend).kind !== 'weekend') weekend = addDays(weekend, 1);
    await showMonthOf(weekend);
    expect(day(weekend)?.disabled).toBe(true);

    const yesterday = addDays(todayInBishkek(), -1);
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[aria-label="Предыдущий месяц"]')?.click(),
    );
    await act(async () =>
      document.querySelector<HTMLButtonElement>('[aria-label="Следующий месяц"]')?.click(),
    );
    if (day(yesterday)) expect(day(yesterday)?.disabled).toBe(true);

    const working = nextWorkingDay(addDays(todayInBishkek(), 3));
    await showMonthOf(working);
    await act(async () => day(working)?.click());
    await waitFor(() => !document.querySelector('[data-date]'));
    expect((d.querySelector('#nt-due') as HTMLButtonElement).textContent).toContain(
      formatIsoDate(working, 'd MMMM yyyy', 'ru'),
    );
  });

  it('календарь срока: быстрый выбор «Через 2 рабочих дня»', async () => {
    const d = await openForm();
    await act(async () => (d.querySelector('#nt-due') as HTMLButtonElement).click());
    await waitFor(() => !!button('Через 2 рабочих дня'));
    await act(async () => button('Через 2 рабочих дня')?.click());
    expect((d.querySelector('#nt-due') as HTMLButtonElement).textContent).toContain(
      formatIsoDate(addWorkingDays(todayInBishkek(), 2), 'd MMMM yyyy', 'ru'),
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

  it('похожая задача: без подтверждения сервер не создаёт, с подтверждением — создаёт', async () => {
    await render('/tasks');
    const input = {
      title: 'Антидопинговый план на 2028 год',
      description: '',
      assignee: createMockTasks().department[0].assignee as Person,
      due: nextWorkingDay(addDays(todayInBishkek(), 3)),
      project: null,
      priority: 'normal' as const,
    };
    await expect(createTask(input)).rejects.toMatchObject({ code: 'possible_duplicate' });
    const created = await createTask({ ...input, confirmDuplicate: true });
    expect(created.title).toBe('Антидопинговый план на 2028 год');
  });
});
