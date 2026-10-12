import * as Tooltip from '@radix-ui/react-tooltip';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { sessionQueryKey } from '@/features/auth/useSession';
import { ApiError } from '@/shared/api/client';
import { ThemeProvider } from './ThemeProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    // 403 от API: права могли измениться — перечитываем сессию, интерфейс подстроится
    const onError = (error: unknown) => {
      if (error instanceof ApiError && error.status === 403) {
        client.invalidateQueries({ queryKey: sessionQueryKey });
      }
    };
    const client = new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
    });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
