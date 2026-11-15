import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Активные сессии сотрудника (бэкенд: apps/accounts/sessions.py, /api/auth/sessions).
 * Браузеры и мобильное приложение; текущая — первой, завершить её нельзя (для неё «Выйти»).
 */
export type LoginSession = {
  id: string;
  client: 'web' | 'mobile';
  /** «Chrome · macOS»; пусто — устройство неизвестно (сессия открыта до учёта устройств) */
  device: string;
  userAgent: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
};

const key = ['auth', 'sessions'] as const;

export const fetchSessions = () => api.get<LoginSession[]>('/auth/sessions');

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

export function useTerminateOtherSessions() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ terminated: number }>('/auth/sessions/terminate-others'),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
    meta: {
      successMessage: (r: { terminated: number }) => ({
        key: 'profile.sessions.terminatedOthers',
        params: { count: r.terminated },
      }),
    },
  });
}
