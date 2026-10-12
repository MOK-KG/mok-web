import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AuthGate, LoginPage, PendingPage } from '@/features/auth';
import { HomePage } from './HomePage';

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <AuthGate access="guest">
        <LoginPage />
      </AuthGate>
    ),
  },
  {
    path: '/pending',
    element: (
      <AuthGate access="pending">
        <PendingPage />
      </AuthGate>
    ),
  },
  {
    path: '/',
    element: (
      <AuthGate access="active">
        <HomePage />
      </AuthGate>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes, {
  // Поведение React Router v7 заранее — меньше работы при переходе и нет предупреждений в консоли
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
