import type { Session } from './types';

/**
 * Заглушка авторизации, пока нет бэкенда.
 *
 * Включается переменной VITE_AUTH_MOCK (active | pending | denied) или параметром ?mock=
 * на странице входа — им удобно проверять все состояния экрана.
 * Данные вымышленные (см. CLAUDE.md, раздел «Данные»).
 */
export type MockOutcome = 'active' | 'pending' | 'denied';

const SESSION_KEY = 'nok.mockSession';
const OUTCOMES: MockOutcome[] = ['active', 'pending', 'denied'];

export const mockUser = { email: 'a.duysheyev@olympic.kg', name: 'Айбек Дуйшеев' };
export const mockForeignEmail = 'a.duysheyev@gmail.com';

const isOutcome = (value: unknown): value is MockOutcome => OUTCOMES.includes(value as MockOutcome);

export function mockOutcome(): MockOutcome | null {
  const fromUrl = new URLSearchParams(window.location.search).get('mock');
  if (isOutcome(fromUrl)) return fromUrl;
  const fromEnv = import.meta.env.VITE_AUTH_MOCK;
  return isOutcome(fromEnv) ? fromEnv : null;
}

export const isMockEnabled = () => mockOutcome() !== null;

// В тестах без задержек
const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : ms));

export const mockApi = {
  async getSession(): Promise<Session | null> {
    await delay(150);
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },

  /** Имитирует переход в Google и возврат обратно */
  async startGoogleSignIn(outcome: MockOutcome): Promise<void> {
    await delay(1200);
    if (outcome === 'denied') {
      const params = new URLSearchParams({ error: 'forbidden_domain', email: mockForeignEmail });
      window.location.assign(`/login?${params}`);
      return;
    }
    const session: Session = { status: outcome, user: mockUser };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  async signOut(): Promise<void> {
    sessionStorage.removeItem(SESSION_KEY);
  },
};
