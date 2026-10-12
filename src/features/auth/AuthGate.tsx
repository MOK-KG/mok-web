import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from './useSession';

type Access = 'guest' | 'pending' | 'active';

/** Куда отправить пользователя с данным статусом */
const homeFor = { guest: '/login', pending: '/pending', active: '/' } as const;

/**
 * Пускает на страницу только с нужным статусом, иначе перенаправляет:
 * без сессии — на /login, без роли — на /pending, с ролью — на главную.
 */
export function AuthGate({ access, children }: { access: Access; children: ReactNode }) {
  const session = useSession();

  if (session.isPending) {
    return <div className="min-h-screen bg-panel" aria-busy />;
  }

  const current: Access = session.data ? session.data.status : 'guest';
  if (current !== access) return <Navigate to={homeFor[current]} replace />;
  return children;
}
