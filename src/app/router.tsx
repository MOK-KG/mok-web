import { lazy, type ReactElement, Suspense } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AuthGate, LoginPage, PendingPage, RequirePermission } from '@/features/auth';
import { PrivacyPage } from '@/features/legal/PrivacyPage';
import { type Section, sections } from '@/shared/config/permissions';
import { AppLayout, type RouteHandle } from './layout/AppLayout';

// Разделы грузятся отдельными чанками — только когда их открывают
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const CalendarPage = lazy(() =>
  import('@/features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })),
);
const DocumentsPage = lazy(() =>
  import('@/features/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const FilesPage = lazy(() =>
  import('@/features/files/FilesPage').then((m) => ({ default: m.FilesPage })),
);
const JournalPage = lazy(() =>
  import('@/features/journal/JournalPage').then((m) => ({ default: m.JournalPage })),
);
const AssistantPage = lazy(() =>
  import('@/features/assistant/AssistantPage').then((m) => ({ default: m.AssistantPage })),
);
const AbsencesPage = lazy(() =>
  import('@/features/absences/AbsencesPage').then((m) => ({ default: m.AbsencesPage })),
);
const SearchPage = lazy(() =>
  import('@/features/search/SearchPage').then((m) => ({ default: m.SearchPage })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
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
const ChatPage = lazy(() =>
  import('@/features/chat/ChatPage').then((m) => ({ default: m.ChatPage })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const RoleMatrixPage = lazy(() =>
  import('@/features/roles/RoleMatrixPage').then((m) => ({ default: m.RoleMatrixPage })),
);
const ProjectsPage = lazy(() =>
  import('@/features/tasks/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const MarkdownViewer = lazy(() =>
  import('@/features/files/MarkdownViewer').then((m) => ({ default: m.MarkdownViewer })),
);
const GraphPage = lazy(() =>
  import('@/features/knowledge-base/graph/GraphPage').then((m) => ({ default: m.GraphPage })),
);
const ArticlePage = lazy(() =>
  import('@/features/knowledge-base/ArticlePage').then((m) => ({ default: m.ArticlePage })),
);

/** Страница каждого раздела меню; новый раздел без страницы — ошибка типов */
const sectionPages: Record<Section, () => ReactElement> = {
  dashboard: () => <DashboardPage />,
  calendar: () => <CalendarPage />,
  documents: () => <DocumentsPage />,
  files: () => <FilesPage />,
  tasks: () => <TasksPage />,
  knowledge: () => <KnowledgePage />,
  access: () => <RolesPage />,
  chat: () => <ChatPage />,
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
    element: guarded(section, sectionPages[section]()),
  })),
  {
    path: 'tasks/projects',
    handle: { section: 'tasks', titleKey: 'projects.title' } satisfies RouteHandle,
    element: guarded('tasks', <ProjectsPage />),
  },
  {
    path: 'knowledge/graph',
    handle: { section: 'knowledge', titleKey: 'knowledge.graph.title' } satisfies RouteHandle,
    element: guarded('knowledge', <GraphPage />),
  },
  {
    path: 'knowledge/:articleId',
    handle: { section: 'knowledge' } satisfies RouteHandle,
    element: guarded('knowledge', <ArticlePage />),
  },
  // Журнал действий — внутри «Ролей и доступа», только с правом journal.view
  {
    path: 'access/journal',
    handle: { section: 'access', titleKey: 'journal.title' } satisfies RouteHandle,
    element: guarded(
      'access',
      <RequirePermission permission="journal.view">
        <JournalPage />
      </RequirePermission>,
    ),
  },
  {
    path: 'access/roles',
    handle: { section: 'access', titleKey: 'access.matrix' } satisfies RouteHandle,
    element: guarded('access', <RoleMatrixPage />),
  },
  // Настройки ИИ и агента почты — внутри «Ролей и доступа», только с правом assistant.manage
  {
    path: 'access/assistant',
    handle: { section: 'access', titleKey: 'assistant.title' } satisfies RouteHandle,
    element: guarded(
      'access',
      <RequirePermission permission="assistant.manage">
        <AssistantPage />
      </RequirePermission>,
    ),
  },
  // Отпуск и командировки — всем, у кого есть вход: свои отсутствия оформляет каждый
  {
    path: 'absences',
    handle: { titleKey: 'absences.title' } satisfies RouteHandle,
    element: (
      <Suspense fallback={null}>
        <AbsencesPage />
      </Suspense>
    ),
  },
  // Поиск по системе — всем; находит только то, к чему есть доступ
  {
    path: 'search',
    handle: { titleKey: 'search.title' } satisfies RouteHandle,
    element: (
      <Suspense fallback={null}>
        <SearchPage />
      </Suspense>
    ),
  },
  // Просмотр файла .md из любого раздела (права на файл проверяет бэкенд)
  {
    path: 'view',
    handle: { titleKey: 'files.viewerTitle' } satisfies RouteHandle,
    element: (
      <Suspense fallback={null}>
        <MarkdownViewer />
      </Suspense>
    ),
  },
  // Профиль и уведомления — у каждого свой
  {
    path: 'profile',
    handle: { titleKey: 'profile.title' } satisfies RouteHandle,
    element: (
      <Suspense fallback={null}>
        <ProfilePage />
      </Suspense>
    ),
  },
  // Уведомления — всем, у кого есть вход; это не раздел меню, а экран колокольчика
  {
    path: 'notifications',
    handle: { titleKey: 'notifications.title' } satisfies RouteHandle,
    element: (
      <Suspense fallback={null}>
        <NotificationsPage />
      </Suspense>
    ),
  },
  // Новая статья — только с правом knowledge.edit; правка — ещё и своих заметок ассистента
  // (редактор сам покажет 403, если статью править нельзя)
  ...(
    [
      ['knowledge/new', 'knowledge.edit'],
      ['knowledge/:articleId/edit', 'knowledge.view'],
    ] as const
  ).map(([path, permission]) => ({
    path,
    handle: { section: 'knowledge' } satisfies RouteHandle,
    element: (
      <RequirePermission permission={permission}>
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
  { path: '/privacy', element: <PrivacyPage /> },
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
