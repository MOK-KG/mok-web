import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Активные сессии сотрудника (бэкенд: apps/accounts/sessions.py, /api/auth/sessions).
 * Браузеры и мобильное приложение; текущая — первой, завершить её нельзя (для неё «Выйти»).
 * Завершение снимает и браузерные уведомления той сессии.
 */
export type LoginSession = {
  /** Не ключ сессии — его хэш */
  id: string;
  /** «Chrome · macOS», «НОК КР · iPhone», «Неизвестное устройство» */
  device: string;
  platform: 'web' | 'ios' | 'android';
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

const key = ['auth', 'sessions'] as const;

export const fetchSessions = async () =>
  (await api.get<{ sessions: LoginSession[] }>('/auth/sessions')).sessions;

export function useLoginSessions() {
  return useQuery({ queryKey: key, queryFn: fetchSessions, refetchInterval: 60_000 });
}

export function useTerminateSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/auth/sessions/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
    meta: { successMessage: 'profile.sessions.terminated' },
  });
}

/** Завершить все, кроме текущей */
export function useTerminateOtherSessions() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>('/auth/sessions'),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
    meta: { successMessage: 'profile.sessions.terminatedAll' },
  });
}
