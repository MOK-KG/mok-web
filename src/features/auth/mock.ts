import { mockRoleMatrix, type RoleCode, roleCodes } from '@/shared/config/permissions';
import type { Session } from './types';

/**
 * Заглушка авторизации, пока нет бэкенда.
 *
 * Исход входа: VITE_AUTH_MOCK (active | pending | denied) или ?mock= на странице входа.
 * Роль: VITE_AUTH_MOCK_ROLE (R1–R9, по умолчанию R1) или ?role=.
 * Смена роли «на лету» (проверка 3 из блокирующих): в консоли браузера
 *   window.__nokMock.setRole('R6')
 * Данные вымышленные (см. CLAUDE.md, раздел «Данные»).
 */
export type MockOutcome = 'active' | 'pending' | 'denied';

const SESSION_KEY = 'nok.mockSession';
const OUTCOMES: MockOutcome[] = ['active', 'pending', 'denied'];

export const mockForeignEmail = 'a.duysheyev@gmail.com';

const isOutcome = (value: unknown): value is MockOutcome => OUTCOMES.includes(value as MockOutcome);
const isRole = (value: unknown): value is RoleCode => roleCodes.includes(value as RoleCode);

export function mockOutcome(): MockOutcome | null {
  const fromUrl = new URLSearchParams(window.location.search).get('mock');
  if (isOutcome(fromUrl)) return fromUrl;
  const fromEnv = import.meta.env.VITE_AUTH_MOCK;
  return isOutcome(fromEnv) ? fromEnv : null;
}

export const isMockEnabled = () => mockOutcome() !== null;

function mockRole(): RoleCode {
  const fromUrl = new URLSearchParams(window.location.search).get('role');
  if (isRole(fromUrl)) return fromUrl;
  const fromEnv = import.meta.env.VITE_AUTH_MOCK_ROLE;
  return isRole(fromEnv) ? fromEnv : 'R1';
}

export function mockSessionFor(status: Session['status'], role: RoleCode): Session {
  return {
    status,
    user: {
      email: 'a.duysheyev@olympic.kg',
      name: 'Айбек Дуйшеев',
      position: 'Ген. секретарь',
      department: 'Административный департамент',
      roles: status === 'active' ? [role] : [],
      permissions: status === 'active' ? mockRoleMatrix[role] : [],
    },
  };
}

// В тестах без задержек
const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : ms));

const read = (): Session | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};

const write = (session: Session | null) => {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
};

export const mockApi = {
  async getSession(): Promise<Session | null> {
    await delay(150);
    return read();
  },

  /** Имитирует переход в Google и возврат обратно */
  async startGoogleSignIn(outcome: MockOutcome): Promise<void> {
    await delay(1200);
    if (outcome === 'denied') {
      const params = new URLSearchParams({ error: 'forbidden_domain', email: mockForeignEmail });
      window.location.assign(`/login?${params}`);
      return;
    }
    write(mockSessionFor(outcome, mockRole()));
  },

  async signOut(): Promise<void> {
    write(null);
  },

  /** Сменить роль текущему пользователю — как будто администратор поменял её на бэкенде */
  setRole(role: RoleCode) {
    if (!isRole(role)) throw new Error(`Нет роли ${role}. Есть: ${roleCodes.join(', ')}`);
    write(mockSessionFor('active', role));
  },
};

if (import.meta.env.DEV) {
  (window as unknown as { __nokMock: typeof mockApi }).__nokMock = mockApi;
}
