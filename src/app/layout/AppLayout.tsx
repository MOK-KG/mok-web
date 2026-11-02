import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatches } from 'react-router-dom';
import type { Section } from '@/shared/config/permissions';
import { storage } from '@/shared/lib/storage';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const COLLAPSED_KEY = 'nok.sidebarCollapsed';

/**
 * Раздел страницы — в handle маршрута: { section: 'tasks' }. Страница вне разделов меню
 * (уведомления) задаёт заголовок ключом перевода: { titleKey: 'notifications.title' }
 */
export type RouteHandle = { section?: Section; titleKey?: string };

const SubtitleContext = createContext<(subtitle: string | null) => void>(() => {});

/** Подпись в шапке вместо «департамент · дата»: «64 статьи в 7 разделах» */
export function usePageSubtitle(subtitle: string | null | undefined) {
  const set = useContext(SubtitleContext);
  useEffect(() => {
    set(subtitle ?? null);
    return () => set(null);
  }, [set, subtitle]);
}

/** Каркас приложения: боковое меню слева, шапка и содержимое раздела справа */
export function AppLayout() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSED_KEY) === '1');
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const handles = [...useMatches()].reverse().map((m) => m.handle as RouteHandle | undefined);
  const section = handles.map((h) => h?.section).find(Boolean);
  const titleKey = handles.map((h) => h?.titleKey).find(Boolean);

  const toggle = () =>
    setCollapsed((c) => {
      storage.set(COLLAPSED_KEY, c ? '0' : '1');
      return !c;
    });

  return (
    <div className="flex h-screen gap-4 bg-canvas p-4">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
        <TopBar
          title={titleKey ? t(titleKey) : section ? t(`sections.${section}`) : t('app.title')}
          subtitle={subtitle}
        />
        <main className="min-h-0 flex-1 overflow-auto">
          <SubtitleContext.Provider value={setSubtitle}>
            <Outlet />
          </SubtitleContext.Provider>
        </main>
      </div>
    </div>
  );
}
