import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { tasksServer } from '@/features/tasks/testing/server';
import { toNotification } from './api';
import { notificationsServer } from './testing/server';

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
const button = (label: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

async function open(url: string, language = 'ru') {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R3')));
  await i18n.changeLanguage(language);
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

describe('формат бэкенда', () => {
  it('id строкой, пустые params — null', () => {
    const n = toNotification({
      id: 7,
      kind: 'done',
      title: 'x',
      text: '',
      params: {},
      at: '2026-11-16T09:00:00Z',
      read: false,
      target: null,
    });
    expect(n.id).toBe('7');
    expect(n.params).toBeNull();
  });
});

describe('уведомления с бэкенда', () => {
  afterEach(async () => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
    await i18n.changeLanguage('ru');
  });

  it('назначение: заголовок по params на языке интерфейса, кнопка открывает задачу по id', async () => {
    const task = tasksServer.tasks.find((t) => !t.archived && t.status !== 'done');
    if (!task) throw new Error('нет задачи');
    notificationsServer.push({
      kind: 'assigned',
      title: `Новая задача · «${task.title}»`,
      text: '',
      params: { task: task.title, code: task.code, actor: 'Н. Бакиров', date: '' },
      at: new Date().toISOString(),
      read: false,
      target: { kind: 'task', taskId: task.id, taskTitle: task.title },
    });
    const router = await open('/notifications', 'en');
    await waitFor(() => text().includes(`New task · “${task.title}”`));
    expect(text()).toContain('Assigned by Н. Бакиров');
    await act(async () => button('Open task')?.click());
    await waitFor(() => router.state.location.search.includes(`task=${task.id}`));
    // Прочитано на сервере
    expect(notificationsServer.items[0].read).toBe(true);
  });

  it('«Прочитать все» и настройки уходят на сервер; назначения выключить нельзя', async () => {
    await open('/notifications?settings=1');
    await waitFor(() => text().includes('Назначенные мне задачи'));
    const switches = [...document.querySelectorAll<HTMLInputElement>('[role=switch]')];
    // Черновик — из сохранённых настроек: все включены
    await waitFor(() => !!switches.at(-1)?.checked);
    expect(switches[0].disabled).toBe(true);
    // Выключить «Завершённые задачи» и сохранить
    await act(async () => switches.at(-1)?.click());
    await act(async () => button('Сохранить')?.click());
    await waitFor(() => notificationsServer.settings.done === false);
    expect(notificationsServer.settings.assigned).toBe(true);
    await waitFor(() => !text().includes('Квартальный отчёт для ОКС'));
    await act(async () => button('Прочитать все')?.click());
    await waitFor(() => notificationsServer.items.every((n) => n.kind === 'done' || n.read));
  });
});
