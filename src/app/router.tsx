import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AuthGate, LoginPage, PendingPage, RequirePermission } from '@/features/auth';
import { SectionPage } from '@/features/sections/SectionPage';
import { type Section, sections } from '@/shared/config/permissions';
import { AppLayout, type RouteHandle } from './layout/AppLayout';

/** Пути разделов меню */
export const sectionPaths: Record<Section, string> = {
  dashboard: '/',
  tasks: '/tasks',
  calendar: '/calendar',
  chat: '/chat',
  knowledge: '/knowledge',
  documents: '/documents',
  files: '/files',
  access: '/access',
};

// Разделы внутри каркаса. Без права — экран 403 по прямой ссылке (адрес не меняется)
const sectionRoutes: RouteObject[] = (Object.keys(sections) as Section[]).map((section) => ({
  ...(section === 'dashboard' ? { index: true } : { path: sectionPaths[section].slice(1) }),
  handle: { section } satisfies RouteHandle,
  element: (
    <RequirePermission permission={sections[section]}>
      <SectionPage />
    </RequirePermission>
  ),
}));

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
        <AppLayout />
      </AuthGate>
    ),
    children: sectionRoutes,
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
