import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { calendarConnectResult, eventsOn, fetchEvents } from '@/features/calendar/events';
import { calendarServer } from '@/features/calendar/testing/server';
import { resetTasksMock } from '@/features/tasks/api';
import type { RoleCode } from '@/shared/config/permissions';
import { decideBotAction, fetchBot, isThinking, sendToBot } from './bot';
import { assistantServer } from './testing/server';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ассистент в чате (запросы)', () => {
  it('вопрос, ответ и карточка: действие — только после подтверждения', async () => {
    const sent = await sendToBot({ text: 'Поставь задачу подготовить ответ' });
    const { messages, conversation } = await fetchBot(sent.conversationId);
    expect(conversation?.title).toBe('Поставь задачу подготовить ответ');
    expect(messages.map((m) => m.role)).toEqual(['user', 'action', 'assistant']);
    const card = messages[1].action;
    expect(card?.status).toBe('pending');
    const done = await decideBotAction({ id: card?.id ?? '', decision: 'confirm' });
    expect(done).toMatchObject({ status: 'done', result: { code: 'ЗД-2026-0099' } });
    await expect(decideBotAction({ id: card?.id ?? '', decision: 'cancel' })).rejects.toMatchObject(
      { code: 'action_decided' },
    );
  });

  it('«думает», пока вопрос в очереди или в работе', () => {
    const base = {
      id: 1,
      role: 'user' as const,
      text: '',
      error: '',
      action: null,
      sources: [],
      steps: [],
      at: '',
    };
    expect(isThinking([{ ...base, status: 'processing' }])).toBe(true);
    expect(isThinking([{ ...base, status: 'failed' }])).toBe(false);
  });

  it('события календаря: по дням; возврат из Google', async () => {
    const list = await fetchEvents(calendarServer.day, calendarServer.day);
    expect(eventsOn(list).get(calendarServer.day)?.[0].title).toBe('Встреча по аккредитации');
    expect(calendarConnectResult(new URLSearchParams('calendar=connected'))).toEqual({
      status: 'connected',
    });
    expect(calendarConnectResult(new URLSearchParams('calendar=error'))).toEqual({
      status: 'error',
      reason: 'google_error',
    });
    expect(calendarConnectResult(new URLSearchParams(''))).toBeNull();
  });
});

let root: Root;
let container: HTMLDivElement;
const page = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${page().slice(-600)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === label,
  );
const typeInto = async (el: HTMLTextAreaElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

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
  return router;
}

describe('ассистент, календарь и Google Календарь (экраны)', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('ассистент первым в списке чатов, открывается по ?c=assistant', async () => {
    const router = await open('/chat?c=c-admin');
    await waitFor(() => !!button('АссистентЗадачи, календарь, база знаний'));
    await act(async () => button('АссистентЗадачи, календарь, база знаний')?.click());
    expect(router.state.location.search).toBe('?c=assistant');
    await waitFor(() => page().includes('Чем помочь?'));
  });

  it('вопрос → ответ со ссылкой на статью и источником', async () => {
    await open('/chat?c=assistant');
    await waitFor(() => page().includes('Чем помочь?'));
    const area = document.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Напишите ассистенту…"]',
    );
    if (!area) throw new Error('нет поля');
    await typeInto(area, 'Кто отвечает за аккредитацию?');
    await act(async () => {
      area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await waitFor(() => page().includes('Ответ по статье'));
    const links = document.querySelectorAll('a[href="/knowledge/zony-otvetstvennosti"]');
    // Ссылка в тексте и источник под ответом
    expect(links.length).toBe(2);
    expect(page()).toContain('1 шаг');
    expect(area.value).toBe('');
  });

  it('карточка задачи: «Создать» выполняет; «Новый разговор» — прежний остаётся вкладкой', async () => {
    await open('/chat?c=assistant');
    await waitFor(() => page().includes('Чем помочь?'));
    await act(async () => button('Поставь задачу подготовить ответ федерации до пятницы')?.click());
    await waitFor(() => page().includes('Новая задача'));
    expect(page()).toContain('Нурлан Бакиров');
    expect(page()).toContain('Подготовил карточку');
    await act(async () => button('Создать')?.click());
    await waitFor(() => page().includes('Выполнено'));
    expect(document.querySelector('a[href*="task=t-bot"]')?.textContent).toBe('ЗД-2026-0099');

    // Память ассистента — ссылка в шапке
    expect(document.querySelector('a[href="/knowledge/assistant-notes"]')?.textContent).toContain(
      'Память',
    );

    await act(async () => button('Новый разговор')?.click());
    await waitFor(() => page().includes('Чем помочь?'));
    const tabs = () => [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    await waitFor(() => tabs().length === 2);
    expect(tabs().map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(assistantServer.bot.messages).toHaveLength(3);
    // Вернуться к прежнему разговору — карточка на месте
    await act(async () => tabs()[1].click());
    await waitFor(() => page().includes('ЗД-2026-0099'));
  });

  it('карточку можно отменить; без ключа — ассистент недоступен', async () => {
    await open('/chat?c=assistant');
    await waitFor(() => page().includes('Чем помочь?'));
    await act(async () => button('Поставь задачу подготовить ответ федерации до пятницы')?.click());
    await waitFor(() => !!button('Отмена'));
    await act(async () => button('Отмена')?.click());
    await waitFor(() => page().includes('Отменено'));
    act(() => root.unmount());
    container.remove();

    assistantServer.bot.available = false;
    assistantServer.bot.messages = [];
    assistantServer.bot.conversations = [];
    await open('/chat?c=assistant');
    await waitFor(() => page().includes('Ассистент недоступен'));
  });

  it('календарь: событие в клетке и в панели дня; своё можно отменить', async () => {
    const day = calendarServer.day;
    await open(`/calendar?d=${day}&m=${day.slice(0, 7)}`);
    await waitFor(() => page().includes('Встреча по аккредитации'));
    expect(page()).toContain('10:00–11:00');
    // Событие из Google Календаря — только чтение
    expect(page()).toContain('Созвон с ОКА');
    expect(page()).toContain('из Google');
    expect(document.querySelector('a[href^="https://calendar.google.com"]')).not.toBeNull();
    expect(
      [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Отменить'),
    ).toHaveLength(1);
    await act(async () => button('Отменить')?.click());
    await waitFor(() => !page().includes('Встреча по аккредитации'));
    expect(calendarServer.events.map((e) => e.title)).toEqual(['Созвон с ОКА']);
  });

  it('профиль: подключить Google Календарь; возврат из Google — тост', async () => {
    await open('/profile');
    await waitFor(() => !!button('Подключить Google Календарь'));
    act(() => root.unmount());
    container.remove();

    Object.assign(calendarServer.connection, { connected: true, email: 'r3@olympic.kg' });
    await open('/profile?calendar=connected');
    await waitFor(() => page().includes('Подключён: r3@olympic.kg'));
    await waitFor(() => page().includes('Google Календарь подключён'));
    await act(async () => button('Отключить')?.click());
    await waitFor(() => !!button('Подключить Google Календарь'));
  });

  it('настройки ИИ: модель ассистента и лимит', async () => {
    await open('/access/assistant', 'R1');
    await waitFor(() => !!document.querySelector('#assistant-bot-limit'));
    expect(document.querySelector<HTMLInputElement>('#assistant-bot-limit')?.value).toBe('200');
  });
});
