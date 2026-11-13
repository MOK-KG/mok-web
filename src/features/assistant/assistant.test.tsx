import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { mockRoleMatrix, type RoleCode } from '@/shared/config/permissions';
import { fetchAssistantSettings, saveAssistantSettings } from './api';
import { assistantServer } from './testing/server';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('настройки ИИ (запросы)', () => {
  it('пароля нет в ответе — только признак, что он задан', async () => {
    const s = await fetchAssistantSettings();
    expect(s.environment).toMatchObject({ mailPassword: true, openaiKey: true });
    expect(JSON.stringify(s).toLowerCase()).not.toMatch(/"password"/);
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

  it('настройки, индикатор пароля и журнал запусков', async () => {
    await render('R1');
    await waitFor(() => page().includes('Последние запуски') && page().includes('RateLimitError'));
    expect(page()).toContain('Пароль ящика задан в окружении сервера');
    expect(page()).toContain('Ключ OpenAI задан в окружении сервера');
    expect(document.querySelector<HTMLInputElement>('#assistant-host')?.value).toBe(
      'imap.olympic.kg',
    );
    // Поля пароля на экране нет
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('без пароля в окружении — предупреждение', async () => {
    assistantServer.settings.environment.mailPassword = false;
    await render('R3');
    await waitFor(() => page().includes('Пароль ящика не задан'));
  });

  it('сохранение: инструкции и роли для базы знаний', async () => {
    await render('R1');
    await waitFor(() => !!document.querySelector('#assistant-instructions'));
    await type('#assistant-instructions', 'Срок ответа МОК — 3 рабочих дня.');
    await act(async () => button('R8')?.click());
    expect(button('R8')?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => button('Сохранить')?.click());
    await waitFor(() => assistantServer.settings.instructions.startsWith('Срок ответа'));
    expect(assistantServer.settings.knowledgeRoles).toEqual(['R8']);
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
