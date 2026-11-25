import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { calendarServer } from '@/features/calendar/testing/server';
import { installKnowledgeServer } from '@/features/knowledge-base/testing/server';
import { resetTasksMock } from '@/features/tasks/api';
import type { RoleCode } from '@/shared/config/permissions';
import { fetchGraph } from './api';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
const page = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${page().slice(-500)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.trim() === label,
  );
const nodes = () =>
  [...document.querySelectorAll<HTMLButtonElement>('[data-node]')].map((b) => b.dataset.node);

async function open(url: string, role: RoleCode = 'R3') {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
  resetTasksMock();
  installKnowledgeServer();
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

describe('граф базы знаний и события календаря (экраны)', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('граф: статьи узлами, счётчик совпадает, фильтр раздела, клик открывает статью', async () => {
    const router = await open('/knowledge/graph');
    await waitFor(() => nodes().length > 0);
    const data = await fetchGraph();
    expect(nodes()).toHaveLength(data.nodes.length);
    const links = data.links.filter((l) => l.kind === 'link').length;
    expect(page()).toContain(`Статей: ${data.nodes.length} · связей: ${links}`);

    // Скрыть раздел первой статьи — её узла нет, счётчик меньше
    const first = data.nodes[0];
    await act(async () => button(first.sectionName ?? '')?.click());
    await waitFor(() => !nodes().includes(first.id));
    const left = data.nodes.filter((n) => n.sectionId !== first.sectionId).length;
    expect(nodes()).toHaveLength(left);
    expect(page()).toContain(`Статей: ${left}`);
    await act(async () => button(first.sectionName ?? '')?.click());
    await waitFor(() => nodes().includes(first.id));

    const target = document.querySelector<HTMLButtonElement>(`[data-node="${first.id}"]`);
    await act(async () => target?.click());
    expect(router.state.location.pathname).toBe(`/knowledge/${first.slug}`);
  });

  it('статья: локальный граф и обратные ссылки', async () => {
    await open('/knowledge');
    const data = await fetchGraph();
    const second = data.links[0]?.target.replace('doc:', '');
    const firstTitle = data.nodes.find((n) => n.id === data.links[0]?.source)?.title ?? '';
    act(() => root.unmount());
    container.remove();
    await open(`/knowledge/${second}`);
    await waitFor(() => page().includes('Ссылаются сюда'));
    expect(page()).toContain('Ссылаются сюда 1');
    expect(
      document.querySelector(`a[href="/knowledge/${data.links[0]?.source.replace('doc:', '')}"]`)
        ?.textContent,
    ).toBe(firstTitle);
    expect(document.querySelector('[data-testid="force-graph"]')).not.toBeNull();
  });

  it('из базы знаний есть кнопка «Граф»', async () => {
    await open('/knowledge');
    await waitFor(() => !!document.querySelector('a[href="/knowledge/graph"]'));
  });

  it('календарь: новое событие из формы, с Google Календарём', async () => {
    Object.assign(calendarServer.connection, { connected: true, email: 'r3@olympic.kg' });
    const day = calendarServer.day;
    await open(`/calendar?d=${day}&m=${day.slice(0, 7)}`);
    await waitFor(() => !!button('Новое событие'));
    await act(async () => button('Новое событие')?.click());
    await waitFor(() => page().includes('Добавить в Google Календарь (r3@olympic.kg)'));
    const titleInput = [...document.querySelectorAll<HTMLInputElement>('input')].find((i) =>
      i.closest('label')?.textContent?.startsWith('Название'),
    );
    if (!titleInput) throw new Error('нет поля названия');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        titleInput,
        'Планёрка отдела',
      );
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Создать')?.click());
    await waitFor(() => page().includes('Планёрка отдела'));
    expect(calendarServer.created[0]).toMatchObject({
      title: 'Планёрка отдела',
      date: day,
      startTime: '10:00',
      endTime: '11:00',
      google: true,
    });
  });
});
