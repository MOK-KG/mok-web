import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { createMockKnowledge } from '@/features/knowledge-base/testing/fixtures';
import { installKnowledgeServer } from '@/features/knowledge-base/testing/server';
import { resetTasksMock } from '@/features/tasks/api';
import { people } from '@/features/tasks/directory';
import {
  addGroupMembers,
  createGroup,
  fetchChatMembers,
  fetchChats,
  fetchMessages,
  markChatRead,
  removeGroupMember,
  sendMessage,
  startDirect,
  toMessage,
  unreadTotal,
  updateGroup,
} from './api';
import { chatServer } from './testing/server';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Подставной сервер чата ставится перед каждым тестом (src/test/setup.ts)
describe('чат (логика)', () => {
  it('непрочитанные как в макете: 2 в «Административном», 1 в «Медицинском», всего 3', async () => {
    const chats = await fetchChats();
    expect(chats.find((c) => c.id === 'c-admin')?.unread).toBe(2);
    expect(chats.find((c) => c.id === 'c-medical')?.unread).toBe(1);
    expect(await unreadTotal()).toBe(3);
    await markChatRead('c-admin');
    expect(await unreadTotal()).toBe(1);
  });

  it('список — по последнему сообщению; своё сообщение не непрочитанное', async () => {
    await sendMessage('c-at', { kind: 'text', text: 'Спасибо' });
    const chats = await fetchChats();
    expect(chats[0].id).toBe('c-at');
    expect(chats[0].unread).toBe(0);
  });

  it('личная переписка с тем, кто в отпуске: автоответ с заместителем', async () => {
    await sendMessage('c-me', { kind: 'text', text: 'Вопрос по смете' });
    const last = (await fetchMessages('c-me')).at(-1);
    expect(last).toMatchObject({ kind: 'system', text: people.ka.short });
    expect(last?.system?.kind).toBe('autoreply');
  });

  it('новая переписка с сотрудником создаётся один раз', async () => {
    const id = await startDirect('u-ju');
    expect(await startDirect('u-ju')).toBe(id);
    expect((await fetchChats()).filter((c) => c.peerId === 'u-ju')).toHaveLength(1);
  });

  it('группа: название, описание, участники; выход убирает её из списка', async () => {
    await expect(
      createGroup({ title: 'Я', description: '', memberIds: ['u-ju'] }),
    ).rejects.toMatchObject({ code: 'group_title' });
    await expect(
      createGroup({ title: 'Пусто', description: '', memberIds: [] }),
    ).rejects.toMatchObject({ code: 'group_members' });
    const id = await createGroup({
      title: 'Подготовка к Играм',
      description: 'Логистика делегации',
      memberIds: ['u-ju', 'u-ka'],
    });
    const group = (await fetchChats()).find((c) => c.id === id);
    expect(group).toMatchObject({ kind: 'group', description: 'Логистика делегации' });
    expect(group?.memberIds).toHaveLength(3);
    await updateGroup(id, { title: 'Игры-2028' });
    await addGroupMembers(id, ['u-nb']);
    await removeGroupMember(id, 'u-ka');
    const edited = (await fetchChats()).find((c) => c.id === id);
    expect(edited?.title).toBe('Игры-2028');
    expect(edited?.memberIds).toEqual(expect.arrayContaining(['u-ju', 'u-nb']));
    expect(edited?.memberIds).not.toContain('u-ka');
    const me = edited?.createdById ?? '';
    await removeGroupMember(id, me);
    expect((await fetchChats()).some((c) => c.id === id)).toBe(false);
  });

  it('скрытая задача в чате: без названия, с признаком taskHidden', () => {
    const hidden = toMessage({
      id: '1',
      chatId: 'c',
      authorId: 'u',
      at: new Date().toISOString(),
      kind: 'task',
      text: '',
      threadId: null,
      task: { id: null, title: null, status: null, assignee: null, due: null },
      system: null,
      file: null,
    });
    expect(hidden.taskHidden).toBe(true);
    expect(hidden.task).toBeUndefined();
  });

  it('участники — с ролью и департаментом', async () => {
    const members = await fetchChatMembers();
    expect(members['u-ka']).toMatchObject({ short: 'К. Асанов', role: 'R6' });
    expect(members['u-ka'].department).toBe('Административный');
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
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R3')));
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

  it('упоминание: «@» показывает участников, Enter подставляет короткое имя', async () => {
    await open('/chat?c=c-at');
    await waitFor(() => document.querySelector('textarea[role="combobox"]') !== null);
    const area = document.querySelector('textarea[role="combobox"]') as HTMLTextAreaElement;
    const type = (value: string) =>
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(area, value);
        area.setSelectionRange(value.length, value.length);
        area.dispatchEvent(new Event('input', { bubbles: true }));
      });

    await type('Привет @тур');
    await waitFor(() => document.querySelector('[role="listbox"]') !== null);
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('Азамат Турсунов')]);

    await act(() => {
      area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(area.value).toBe('Привет @А. Турсунов ');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('упоминание: Escape закрывает список, Enter отправляет сообщение', async () => {
    await open('/chat?c=c-at');
    await waitFor(() => document.querySelector('textarea[role="combobox"]') !== null);
    const area = document.querySelector('textarea[role="combobox"]') as HTMLTextAreaElement;
    await act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(area, '@тур');
      area.setSelectionRange(4, 4);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await waitFor(() => document.querySelector('[role="listbox"]') !== null);
    await act(() => {
      area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    await act(() => {
      area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await waitFor(() => area.value === '');
  });

  it('новая группа: название и участник → группа открыта, в шапке её название', async () => {
    await open('/chat?c=c-at');
    await waitFor(() => !!document.querySelector('button[aria-label="Новая переписка"]'));
    const click = (el: Element | null | undefined) =>
      act(async () => (el as HTMLElement | null)?.click());
    const byText = (s: string) =>
      [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === s);
    await click(document.querySelector('button[aria-label="Новая переписка"]'));
    await waitFor(() => !!byText('Новая группа'));
    await click(byText('Новая группа'));
    await waitFor(() => !!document.getElementById('group-title'));
    // Без названия и участников — подсказки, группа не создаётся
    await click(byText('Создать группу'));
    expect(text()).toContain('Название — от 2 до 80 символов');
    expect(text()).toContain('Выберите хотя бы одного участника');
    const input = document.getElementById('group-title') as HTMLInputElement;
    await act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        'Подготовка к Играм',
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const box = [...document.querySelectorAll('label')]
      .find((l) => l.textContent?.includes('Нурлан Бакиров'))
      ?.querySelector('input');
    await click(box);
    expect(text()).toContain('Выбрано: 1');
    await click(byText('Создать группу'));
    await waitFor(() => document.querySelector('header h2')?.textContent === 'Подготовка к Играм');
    expect(text()).toContain('группа · 2 участника');
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

  it('статья базы знаний: прикрепляется карточкой со ссылкой на статью', async () => {
    installKnowledgeServer();
    const article = createMockKnowledge().articles[0];
    await open('/chat?c=c-at');
    const attach = () =>
      document.querySelector<HTMLButtonElement>('button[aria-label="Прикрепить статью"]');
    await waitFor(() => !!attach());
    await act(async () => attach()?.click());
    await waitFor(() => text().includes(article.title));
    const pick = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] li button'),
    ].find((b) => b.textContent?.startsWith(article.title));
    await act(async () => pick?.click());
    await waitFor(
      () =>
        !!document.querySelector(
          `a[href="/knowledge/${article.id}"][aria-label^="Открыть статью"]`,
        ),
    );
  });

  it('статья из закрытого раздела: без названия и без ссылки', async () => {
    chatServer?.store.messages.push({
      id: 'm-closed',
      chatId: 'c-at',
      authorId: 'u-ka',
      at: new Date().toISOString(),
      kind: 'article',
      text: '',
      article: { id: null, title: null },
    });
    await open('/chat?c=c-at');
    await waitFor(() => text().includes('Статья из закрытого раздела'));
    expect(document.querySelector('a[href^="/knowledge/"]')).toBeNull();
  });
});
