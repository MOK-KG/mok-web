import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';

export const sessionQueryKey = ['auth', 'session'] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: authApi.getSession,
    retry: false,
    // Смена роли действует без перезапуска: сессия перечитывается при возврате на вкладку,
    // раз в минуту и после любого ответа 403 (см. app/providers)
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.startGoogleSignIn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionQueryKey }),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.signOut,
    onSuccess: () => {
      queryClient.setQueryData(sessionQueryKey, null);
      // Данные прежнего пользователя не должны достаться следующему на этом устройстве.
      // Не clear(): экран входа подписан на запрос сессии и должен увидеть null
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== sessionQueryKey[0] });
    },
  });
}
