import { ApiError, api } from '@/shared/api/client';
import { isMockEnabled, mockApi, mockOutcome } from './mock';
import type { Session, SignInError } from './types';

/**
 * Вход через Google ведёт бэкенд (OAuth): фронт перенаправляет на /auth/google/start,
 * бэкенд проверяет домен и возвращает на /login (ошибка в query) или на главную с сессией
 * в httpOnly-cookie. Контракт уточнится, когда появится OpenAPI.
 */
export const authApi = {
  async getSession(): Promise<Session | null> {
    if (isMockEnabled()) return mockApi.getSession();
    try {
      return await api.get<Session>('/auth/me');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },

  async startGoogleSignIn(): Promise<void> {
    const outcome = mockOutcome();
    if (outcome) return mockApi.startGoogleSignIn(outcome);
    const returnTo = `${window.location.origin}/login`;
    window.location.assign(api.url('/auth/google/start', { returnTo }));
  },

  async signOut(): Promise<void> {
    if (isMockEnabled()) return mockApi.signOut();
    await api.post<void>('/auth/logout');
  },
};

/** Ошибка входа из адреса /login?error=...&email=... */
export function readSignInError(search: URLSearchParams): SignInError | null {
  const code = search.get('error');
  if (!code) return null;
  const email = search.get('email');
  if (code === 'forbidden_domain' && email) return { code, email };
  return { code: 'unknown' };
}
