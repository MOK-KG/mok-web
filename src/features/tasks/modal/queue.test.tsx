import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import {
  createFromLetter,
  journalEntries,
  queueSummary,
  rejectLetter,
  resetTasksMock,
  tabCounts,
} from '../api';
import { canCreate, createMockQueue } from '../mailQueue';

describe('очередь из почты (логика)', () => {
  beforeEach(() => resetTasksMock());

  it('3 письма разобраны, 1 — вручную', () => {
    expect(queueSummary()).toEqual({ ready: 3, manual: 1 });
  });

  it('создание из письма: письмо уходит, задача в очереди с источником «письмо»', async () => {
    const [letter] = createMockQueue();
    if (!letter.suggestion) throw new Error('у первого письма есть предложение');
    const task = await createFromLetter(letter.id, letter.suggestion);
    expect(task.status).toBe('queue');
    expect(task.fromEmail).toBe(true);
    expect(task.source.kind).toBe('email');
    expect(task.history[0]).toMatchObject({ kind: 'created', text: 'email' });
    expect(queueSummary()).toEqual({ ready: 2, manual: 1 });
    expect(tabCounts().department).toBe(21);
    expect(journalEntries()[0].action).toBe('mailAccepted');
  });

  it('письмо без исполнителя создать нельзя', () => {
    const minjust = createMockQueue().find((l) => l.id === 'mail-3');
    expect(minjust?.suggestion && canCreate(minjust.suggestion)).toBe(false);
  });

  it('отклонение требует причину; причина и автор — в журнале', async () => {
    await expect(rejectLetter('mail-2', 'нет')).rejects.toThrow('reason-required');
    await rejectLetter('mail-2', 'Дубль задачи про Генассамблею');
    expect(queueSummary()).toEqual({ ready: 2, manual: 1 });
    expect(journalEntries()[0]).toMatchObject({
      action: 'mailRejected',
      author: 'А. Дуйшеев',
      details: 'Приглашение на Генеральную ассамблею: Дубль задачи про Генассамблею',
    });
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let router: ReturnType<typeof createMemoryRouter>;
const page = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${page().slice(0, 300)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.trim().startsWith(text),
  );

describe('очередь из почты (интерфейс)', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'active');
    sessionStorage.clear();
    sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R1')));
    resetTasksMock();
    await i18n.changeLanguage('ru');
    router = createMemoryRouter(routes, { initialEntries: ['/tasks'] });
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
    await waitFor(() => !!button('Разобрать'));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('«Разобрать» → «Создать задачу» → открывается созданная задача', async () => {
    await act(async () => button('Разобрать')?.click());
    await waitFor(() => page().includes('Предложение модели'));
    expect(page()).toContain('3 разобраны, 1 нужно оформить вручную');
    await act(async () => button('Создать задачу')?.click());
    await waitFor(() => router.state.location.search.includes('task='));
    // Заголовок уже есть на доске — ждём историю в карточке задачи
    await waitFor(() => page().includes('Задача создана из письма'));
    expect(router.state.location.search).toMatch(/task=/);
  });

  it('отклонение без причины не проходит', async () => {
    await act(async () => button('Разобрать')?.click());
    await waitFor(() => !!button('Отклонить…'));
    await act(async () => button('Отклонить…')?.click());
    await waitFor(() => page().includes('Отклонить письмо'));
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Отклонить',
    );
    await act(async () => confirm?.click());
    expect(page()).toContain('Укажите причину — хотя бы 5 символов');
    expect(queueSummary().ready).toBe(3);
  });
});
