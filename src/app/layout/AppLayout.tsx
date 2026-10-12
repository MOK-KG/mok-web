import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatches } from 'react-router-dom';
import type { Section } from '@/shared/config/permissions';
import { storage } from '@/shared/lib/storage';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const COLLAPSED_KEY = 'nok.sidebarCollapsed';

/** Раздел страницы — в handle маршрута: { section: 'tasks' } */
export type RouteHandle = { section?: Section };

/** Каркас приложения: боковое меню слева, шапка и содержимое раздела справа */
export function AppLayout() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSED_KEY) === '1');
  const section = [...useMatches()]
    .reverse()
    .map((m) => (m.handle as RouteHandle | undefined)?.section)
    .find(Boolean);

  const toggle = () =>
    setCollapsed((c) => {
      storage.set(COLLAPSED_KEY, c ? '0' : '1');
      return !c;
    });

  return (
    <div className="flex h-screen gap-4 bg-canvas p-4">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
        <TopBar title={section ? t(`sections.${section}`) : t('app.title')} />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
