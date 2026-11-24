import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { mockRoleMatrix, type RoleCode } from '@/shared/config/permissions';
import {
  disconnectMailbox,
  fetchAssistantSettings,
  fetchMailboxes,
  mailboxConnectResult,
  saveAssistantSettings,
  updateMailbox,
} from './api';
import { assistantServer } from './testing/server';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('настройки ИИ (запросы)', () => {
  it('ключа нет в ответе — только признак, что он задан; настроек IMAP нет', async () => {
    const s = await fetchAssistantSettings();
    expect(s.environment).toMatchObject({ openaiKey: true });
    expect(JSON.stringify(s).toLowerCase()).not.toMatch(/password|imap/);
  });

  it('ящики: список, метка, выключение, отключение', async () => {
    const [box] = await fetchMailboxes();
    expect(box).toMatchObject({ email: 'info@olympic.kg', label: 'INBOX', enabled: true });
    expect(JSON.stringify(box).toLowerCase()).not.toMatch(/token/);
    expect(await updateMailbox({ id: box.id, label: ' Задачи ' })).toMatchObject({
      label: 'Задачи',
    });
    expect(await updateMailbox({ id: box.id, enabled: false })).toMatchObject({ enabled: false });
    await disconnectMailbox(box.id);
    expect(await fetchMailboxes()).toEqual([]);
  });

  it('возврат из Google: ?mailbox=…', () => {
    const parse = (q: string) => mailboxConnectResult(new URLSearchParams(q));
    expect(parse('mailbox=connected&email=info%40olympic.kg')).toEqual({
      status: 'connected',
      email: 'info@olympic.kg',
    });
    expect(parse('mailbox=error&reason=scope')).toMatchObject({ status: 'error', reason: 'scope' });
    expect(parse('mailbox=error')).toMatchObject({ reason: 'google_error' });
    expect(parse('tab=1')).toBeNull();
  });

  it('неизвестная роль и интервал вне диапазона — ошибка поля', async () => {
    await expect(
      saveAssistantSettings({ knowledgeRoles: ['R10' as RoleCode] }),
    ).rejects.toMatchObject({ code: 'invalid_value', fields: { knowledgeRoles: 'invalid' } });
    await expect(saveAssistantSettings({ pollMinutes: 0 })).rejects.toMatchObject({
      fields: { pollMinutes: 'invalid' },
    });
  });

  it('право assistant.manage — у Администратора и Генерального секретаря', () => {
    const holders = Object.entries(mockRoleMatrix)
      .filter(([, list]) => list.includes('assistant.manage'))
      .map(([role]) => role);
    expect(holders).toEqual(['R1', 'R3']);
  });
});

let root: Root;
let container: HTMLDivElement;
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
const type = async (selector: string, value: string) => {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!el) throw new Error(`нет поля ${selector}`);
  await act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('настройки ИИ (экран)', () => {
  const render = async (role: RoleCode, path = '/access/assistant') => {
    sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
    const router = createMemoryRouter(routes, { initialEntries: [path] });
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
  };

  beforeEach(async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'active');
    sessionStorage.clear();
    await i18n.changeLanguage('ru');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('настройки, ящики и журнал запусков', async () => {
    await render('R1');
    await waitFor(() => page().includes('Последние запуски') && page().includes('RateLimitError'));
    await waitFor(() => page().includes('info@olympic.kg'));
    expect(page()).toContain('Ключ OpenAI задан в окружении сервера');
    expect(page()).toContain('Планировщик работает · последний проход');
    expect(page()).toContain('подключил(а) Дамира Токтосунова');
    expect(button('Подключить ящик Gmail')).toBeTruthy();
    // Полей IMAP и пароля на экране нет
    expect(document.querySelector('#assistant-host')).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('ящик: метка, отзыв доступа, отключение с подтверждением', async () => {
    assistantServer.mailboxes[0].needsReconnect = true;
    await render('R3');
    await waitFor(() => page().includes('Google отозвал доступ'));
    await type('#mailbox-label-1', 'Задачи');
    await act(async () => {
      document.querySelector<HTMLFormElement>('#mailbox-label-1')?.form?.requestSubmit();
    });
    await waitFor(() => assistantServer.mailboxes[0]?.label === 'Задачи');
    await act(async () => button('Отключить')?.click());
    expect(page()).toContain('Отозвать доступ и отключить ящик?');
    expect(assistantServer.mailboxes).toHaveLength(1);
    const confirm = [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.textContent === 'Отключить',
    );
    await act(async () => confirm.at(-1)?.click());
    await waitFor(() => page().includes('Ни одного ящика не подключено'));
    expect(assistantServer.mailboxes).toHaveLength(0);
  });

  it('возврат из Google — тост и адрес без ?mailbox', async () => {
    await render('R1', '/access/assistant?mailbox=connected&email=docs%40olympic.kg');
    await waitFor(() => page().includes('Ящик docs@olympic.kg подключён'));
    act(() => root.unmount());
    container.remove();
    await render('R1', '/access/assistant?mailbox=error&reason=scope');
    await waitFor(() => page().includes('Нужен доступ к просмотру писем'));
  });

  it('сохранение: инструкции и роли для базы знаний', async () => {
    await render('R1');
    await waitFor(() => !!document.querySelector('#assistant-instructions'));
    await type('#assistant-instructions', 'Срок ответа МОК — 3 рабочих дня.');
    await act(async () => button('R8')?.click());
    expect(button('R8')?.getAttribute('aria-pressed')).toBe('true');
    expect(page()).toContain('Ниже 60% письмо попадает в «Разобрать вручную»');
    await type('#assistant-confidence', '75');
    expect(page()).toContain('Ниже 75% письмо попадает в «Разобрать вручную»');
    await act(async () => button('Сохранить')?.click());
    await waitFor(() => assistantServer.settings.instructions.startsWith('Срок ответа'));
    expect(assistantServer.settings.knowledgeRoles).toEqual(['R8']);
    expect(assistantServer.settings.confidenceMin).toBe(75);
    expect(assistantServer.settings.updatedBy?.name).toBe('Айбек Дуйшеев');
  });

  it('ошибка поля показывается у поля', async () => {
    await render('R1');
    await waitFor(() => !!document.querySelector('#assistant-poll'));
    await type('#assistant-poll', '0');
    await act(async () => button('Сохранить')?.click());
    await waitFor(() => page().includes('Недопустимое значение'));
  });

  it('разобрать очередь сейчас — новый запуск в таблице', async () => {
    await render('R1');
    await waitFor(() => !!button('Разобрать очередь сейчас'));
    await act(async () => button('Разобрать очередь сейчас')?.click());
    await waitFor(() => page().includes('Вручную'));
    expect(assistantServer.runs[0]).toMatchObject({ trigger: 'manual', analyzed: 2 });
  });

  it('планировщик давно не запускался или упал — предупреждение', async () => {
    assistantServer.settings.environment.scheduler = {
      lastRunAt: '2026-11-24T08:00:00Z',
      ok: false,
      lastError: '',
    };
    await render('R1');
    await waitFor(() => page().includes('Планировщик не запускался с'));
    act(() => root.unmount());
    container.remove();
    assistantServer.settings.environment.scheduler = {
      lastRunAt: null,
      ok: false,
      lastError: 'OperationalError: db',
    };
    await render('R1');
    await waitFor(() => page().includes('Планировщик: проход не удался — OperationalError: db'));
  });

  it('выключенный агент — кнопка разбора недоступна', async () => {
    assistantServer.settings.enabled = false;
    await render('R1');
    await waitFor(() => page().includes('Агент выключен.'));
    expect(button('Разобрать очередь сейчас')?.disabled).toBe(true);
  });

  it('проверка на письме: предложение, обоснование и источники', async () => {
    await render('R1');
    await waitFor(() => !!document.querySelector('#dry-subject'));
    await type('#dry-subject', 'Аккредитация делегации');
    await type('#dry-body', 'Просим помочь с аккредитацией.');
    await act(async () => button('Проверить')?.click());
    await waitFor(() => page().includes('Предложение агента') || page().includes('Почему так'));
    expect(page()).toContain('Подготовить ответ: Аккредитация делегации');
    expect(page()).toContain('Нурлан Бакиров');
    expect(page()).toContain('зона юридического отдела');
    expect(page()).toContain('уточнить');
    const link = document.querySelector<HTMLAnchorElement>(
      'a[href="/knowledge/zony-otvetstvennosti"]',
    );
    expect(link?.textContent).toContain('Зоны ответственности');
    expect(page()).toContain('поиск в базе знаний');
  });

  it('без права — экран 403, ссылки в «Ролях и доступе» нет', async () => {
    await render('R4');
    await waitFor(() => page().includes('403') || page().includes('Нет доступа'));
    expect(page()).not.toContain('Разобрать очередь сейчас');
    act(() => root.unmount());
    container.remove();
    await render('R4', '/access');
    await waitFor(() => page().includes('Пользователи') || page().includes('Журнал'));
    expect(document.querySelector('a[href="/access/assistant"]')).toBeNull();
  });

  it('у администратора ссылка в «Ролях и доступе»', async () => {
    await render('R1', '/access');
    await waitFor(() => !!document.querySelector('a[href="/access/assistant"]'));
  });
});
