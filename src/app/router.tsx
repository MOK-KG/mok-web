import { lazy, type ReactElement, Suspense } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AuthGate, LoginPage, PendingPage, RequirePermission } from '@/features/auth';
import { SectionPage } from '@/features/sections/SectionPage';
import { type Section, sections } from '@/shared/config/permissions';
import { AppLayout, type RouteHandle } from './layout/AppLayout';

// Разделы грузятся отдельными чанками — только когда их открывают
const TasksPage = lazy(() =>
  import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
);
const KnowledgePage = lazy(() =>
  import('@/features/knowledge-base/KnowledgePage').then((m) => ({ default: m.KnowledgePage })),
);
const ArticleEditor = lazy(() =>
  import('@/features/knowledge-base/ArticleEditor').then((m) => ({ default: m.ArticleEditor })),
);
const RolesPage = lazy(() =>
  import('@/features/roles/RolesPage').then((m) => ({ default: m.RolesPage })),
);
const ArticlePage = lazy(() =>
  import('@/features/knowledge-base/ArticlePage').then((m) => ({ default: m.ArticlePage })),
);

/** Готовые разделы; остальные пока — заглушка SectionPage */
const sectionPages: Partial<Record<Section, () => ReactElement>> = {
  tasks: () => <TasksPage />,
  knowledge: () => <KnowledgePage />,
  access: () => <RolesPage />,
};

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
const guarded = (section: Section, page: ReactElement) => (
  <RequirePermission permission={sections[section]}>
    <Suspense fallback={null}>{page}</Suspense>
  </RequirePermission>
);

const sectionRoutes: RouteObject[] = [
  ...(Object.keys(sections) as Section[]).map((section) => ({
    ...(section === 'dashboard' ? { index: true } : { path: sectionPaths[section].slice(1) }),
    handle: { section } satisfies RouteHandle,
    element: guarded(section, sectionPages[section]?.() ?? <SectionPage />),
  })),
  {
    path: 'knowledge/:articleId',
    handle: { section: 'knowledge' } satisfies RouteHandle,
    element: guarded('knowledge', <ArticlePage />),
  },
  // Редактор — только с правом knowledge.edit; без него по прямой ссылке — 403
  ...['knowledge/new', 'knowledge/:articleId/edit'].map((path) => ({
    path,
    handle: { section: 'knowledge' } satisfies RouteHandle,
    element: (
      <RequirePermission permission="knowledge.edit">
        {guarded('knowledge', <ArticleEditor />)}
      </RequirePermission>
    ),
  })),
];

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
