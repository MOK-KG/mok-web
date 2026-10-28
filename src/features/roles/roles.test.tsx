import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { journalEntries, resetTasksMock } from '@/features/tasks/api';
import { ApiError } from '@/shared/api/errors';
import type { RoleCode } from '@/shared/config/permissions';
import { changeRole, deactivateStaff, fetchStaff, inviteStaff, resetStaffMock } from './api';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = { email: 'a.duysheyev@olympic.kg', role: 'R1' as RoleCode };
const ACTOR = { id: 's-ad', short: 'А. Дуйшеев' };
const row = (id: string) => fetchStaff(ME).find((r) => r.id === id);
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ApiError ? e.code : 'other';
  }
  return null;
};

describe('роли и доступ (логика)', () => {
  beforeEach(() => {
    resetStaffMock();
    resetTasksMock();
  });

  it('17 строк: 13 сотрудников аппарата, 3 внешних, 1 вакансия; своя роль — из сессии', () => {
    const rows = fetchStaff(ME);
    expect(rows).toHaveLength(17);
    expect(rows.filter((r) => r.status === 'active' || r.status === 'invited')).toHaveLength(13);
    expect(rows.filter((r) => r.status === 'external')).toHaveLength(3);
    expect(rows.filter((r) => r.status === 'vacancy')).toHaveLength(1);
    expect(row('s-ad')).toMatchObject({ isMe: true, role: 'R1' });
  });

  it('увольнение: вход закрыт, сессии прекращены, задачи — директору, запись в журнале', () => {
    const before = row('s-nb');
    expect(before?.plan).toMatchObject({ tasks: 1, reassignTo: { short: 'Б. Осмонов' } });
    expect(deactivateStaff('s-nb', ACTOR)).toEqual({ reassigned: 1 });

    const after = row('s-nb');
    expect(after).toMatchObject({ status: 'deactivated', badge: 'deactivated', sessions: 0 });
    expect(after?.plan.tasks).toBe(0);
    expect(journalEntries().at(-1)).toMatchObject({ action: 'userDeactivated' });
    // Запись не удалена — сотрудник остаётся в списке
    expect(fetchStaff(ME)).toHaveLength(17);
  });

  it('себя и вакансию деактивировать нельзя', () => {
    expect(codeOf(() => deactivateStaff('s-ad', ACTOR))).toBe('deactivate_self');
    expect(codeOf(() => deactivateStaff('s-vacancy-lawyer', ACTOR))).toBe('user_not_active');
  });

  it('приглашение: только @olympic.kg, без повторов; на вакансию — вместо её строки', () => {
    const base = {
      name: 'Асель Орозова',
      position: 'Юрист',
      department: 'Правовой',
      role: 'R8' as RoleCode,
    };
    expect(codeOf(() => inviteStaff({ ...base, email: 'a.orozova@gmail.com' }, 'А. Дуйшеев'))).toBe(
      'email_domain',
    );
    expect(
      codeOf(() => inviteStaff({ ...base, email: 'N.Bakirov@olympic.kg' }, 'А. Дуйшеев')),
    ).toBe('email_exists');
    const member = inviteStaff(
      { ...base, email: ' A.Orozova@olympic.kg ', vacancyId: 's-vacancy-lawyer' },
      'А. Дуйшеев',
    );
    expect(member).toMatchObject({
      email: 'a.orozova@olympic.kg',
      short: 'А. Орозова',
      status: 'invited',
    });
    const rows = fetchStaff(ME);
    expect(rows).toHaveLength(17);
    expect(rows.some((r) => r.status === 'vacancy')).toBe(false);
  });

  it('смена роли пишется в журнал; у уволенного роль не меняется', () => {
    changeRole('s-dt', 'R4', 'А. Дуйшеев');
    expect(row('s-dt')?.role).toBe('R4');
    expect(journalEntries().at(-1)).toMatchObject({
      action: 'roleChanged',
      details: expect.stringContaining('R5 → R4'),
    });
    deactivateStaff('s-dt', ACTOR);
    expect(codeOf(() => changeRole('s-dt', 'R5', 'А. Дуйшеев'))).toBe('user_deactivated');
  });
});

let root: Root;
let container: HTMLDivElement;
const text = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${text().slice(0, 400)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};
const button = (label: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

async function open(url: string, role: RoleCode = 'R1') {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', role)));
  resetStaffMock();
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

describe('роли и доступ (экраны)', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('список: «9 из 17», «Показать все 17» открывает остальных; числа в шапке совпадают', async () => {
    await open('/access');
    await waitFor(() => text().includes('9 из 17'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(9);
    expect(text()).toContain('13 сотрудников аппарата · 3 внешних · 1 вакансия');
    await act(async () => button('Показать все 17')?.click());
    await waitFor(() => text().includes('17 из 17'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(17);
  });

  it('поиск по роли: счётчик равен числу строк', async () => {
    await open('/access?q=Директор');
    await waitFor(() => text().includes('3 из 17'));
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('увольнение из карточки: подтверждение, статус «Деактивирован», задача у директора', async () => {
    await open('/access?user=s-nb');
    await waitFor(() => !!button('Деактивировать'));
    expect(text()).toContain('1 задача переназначена');
    await act(async () => button('Деактивировать')?.click());
    await act(async () => button('Да, деактивировать Н. Бакиров')?.click());
    await waitFor(() => text().includes('Сотрудник деактивирован'));
    await waitFor(() => !!container.querySelector('tbody') && text().includes('Деактивирован'));
    expect(fetchStaff(ME).find((r) => r.id === 's-nb')?.plan.tasks).toBe(0);
  });

  it('без права staff.view — 403 по прямой ссылке', async () => {
    await open('/access', 'R5');
    await waitFor(() => text().includes('Нет доступа'));
  });
});
