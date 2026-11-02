import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { resetNotificationsMock } from '@/features/notifications/api';
import { resetTasksMock } from '@/features/tasks/api';
import { people } from '@/features/tasks/directory';
import {
  fetchChats,
  fetchMessages,
  markChatRead,
  resetChatMock,
  sendMessage,
  startDirect,
  unreadTotal,
} from './api';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('чат (логика)', () => {
  beforeEach(() => resetChatMock());

  it('непрочитанные как в макете: 2 в «Административном», 1 в «Медицинском», всего 3', () => {
    const chats = fetchChats();
    expect(chats.find((c) => c.id === 'c-admin')?.unread).toBe(2);
    expect(chats.find((c) => c.id === 'c-medical')?.unread).toBe(1);
    expect(unreadTotal()).toBe(3);
    markChatRead('c-admin');
    expect(unreadTotal()).toBe(1);
  });

  it('список — по последнему сообщению; своё сообщение не непрочитанное', () => {
    sendMessage('c-at', { kind: 'text', text: 'Спасибо' });
    const chats = fetchChats();
    expect(chats[0].id).toBe('c-at');
    expect(chats[0].unread).toBe(0);
  });

  it('личная переписка с тем, кто в отпуске: автоответ с заместителем', () => {
    sendMessage('c-me', { kind: 'text', text: 'Вопрос по смете' });
    const last = fetchMessages('c-me').at(-1);
    expect(last).toMatchObject({ kind: 'system', text: people.ka.short });
    expect(last?.system?.kind).toBe('autoreply');
  });

  it('новая переписка с сотрудником создаётся один раз', () => {
    const id = startDirect('u-ju');
    expect(startDirect('u-ju')).toBe(id);
    expect(fetchChats().filter((c) => c.peerId === 'u-ju')).toHaveLength(1);
  });
});

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

async function open(url: string) {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R1')));
  resetChatMock();
  resetNotificationsMock();
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

describe('чат и уведомления (экраны)', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('открытая переписка прочитана: счётчик в шапке уменьшается', async () => {
    await open('/chat?c=c-medical');
    await waitFor(() => text().includes('Медицинский департамент'));
    // Было 3 (2 + 1); «Медицинский» открыт и прочитан — осталось 2
    await waitFor(() => text().includes('2 непрочитанных'));
  });

  it('уведомления: вкладки со счётчиками, «Открыть канал» ведёт в чат', async () => {
    await open('/notifications');
    await waitFor(() => text().includes('Все6'));
    const tabs = [...container.querySelectorAll('[role=tab]')].map((t) => t.textContent);
    expect(tabs).toEqual(['Все6', 'Непрочитанные4', 'Упоминания1']);
    const button = [...container.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Открыть канал',
    );
    await act(async () => button?.click());
    await waitFor(() => text().includes('Медицинский департамент'));
  });

  it('вкладка «Непрочитанные»: строк столько же, сколько в счётчике', async () => {
    await open('/notifications?tab=unread');
    await waitFor(() => text().includes('Непрочитанные4'));
    expect(container.querySelectorAll('[role=tabpanel] li')).toHaveLength(4);
  });
});
