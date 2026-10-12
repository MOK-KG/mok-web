import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AuthGate, LoginPage, PendingPage, RequirePermission } from '@/features/auth';
import { SectionPage } from '@/features/sections/SectionPage';
import { type Section, sections } from '@/shared/config/permissions';
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
  // Разделы: без права — экран 403 по прямой ссылке
  ...(Object.keys(sections) as Section[]).map((section) => ({
    path: `/${section}`,
    element: (
      <AuthGate access="active">
        <RequirePermission permission={sections[section]}>
          <SectionPage section={section} />
        </RequirePermission>
      </AuthGate>
    ),
  })),
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
