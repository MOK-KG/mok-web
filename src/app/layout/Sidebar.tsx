import * as Tooltip from '@radix-ui/react-tooltip';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useCan, useSession } from '@/features/auth';
import { useNavCounters } from '@/features/notifications/api';
import { workDomain } from '@/shared/config/links';
import type { Section } from '@/shared/config/permissions';
import {
  AccessIcon,
  CalendarIcon,
  ChatIcon,
  DashboardIcon,
  DocumentsIcon,
  EmblemIcon,
  FilesIcon,
  KnowledgeIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon,
  TasksIcon,
} from '@/shared/ui/icons';

type NavItem = {
  section: Section;
  path: string;
  Icon: ComponentType<{ size?: number }>;
  counter?: 'chat' | 'documents';
};

/** Пункты меню в порядке макета; «Роли и доступ» — после разделителя */
const mainItems: NavItem[] = [
  { section: 'dashboard', path: '/', Icon: DashboardIcon },
  { section: 'tasks', path: '/tasks', Icon: TasksIcon },
  { section: 'calendar', path: '/calendar', Icon: CalendarIcon },
  { section: 'chat', path: '/chat', Icon: ChatIcon, counter: 'chat' },
  { section: 'knowledge', path: '/knowledge', Icon: KnowledgeIcon },
  { section: 'documents', path: '/documents', Icon: DocumentsIcon, counter: 'documents' },
  { section: 'files', path: '/files', Icon: FilesIcon },
];
const adminItems: NavItem[] = [{ section: 'access', path: '/access', Icon: AccessIcon }];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

type Props = { collapsed: boolean; onToggle: () => void };

/** Боковое меню: развёрнутое 224px и свёрнутое 64px (иконки с подсказками) */
export function Sidebar({ collapsed, onToggle }: Props) {
  const { t } = useTranslation();
  const { canOpen } = useCan();
  const counters = useNavCounters();
  const user = useSession().data?.user;

  const renderItem = ({ section, path, Icon, counter }: NavItem) => {
    if (!canOpen(section)) return null;
    const label = t(`sections.${section}`);
    const count = counter ? counters[counter] : undefined;
    const link = (
      <NavLink
        to={path}
        end={path === '/'}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          `group relative flex items-center rounded-9 border text-[12.5px] tracking-[-0.1px] transition-colors ${
            collapsed ? 'size-10 justify-center rounded-[10px]' : 'h-[38px] gap-3 px-3'
          } ${
            isActive
              ? 'border-line bg-control font-semibold text-text'
              : 'border-transparent text-sub hover:bg-row-highlight hover:text-text'
          }`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                aria-hidden
                className={`absolute top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-brand-red ${
                  collapsed ? '-left-[9px]' : '-left-px'
                }`}
              />
            )}
            <Icon size={18} />
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {count !== undefined &&
              count > 0 &&
              (collapsed ? (
                <span
                  aria-hidden
                  className="absolute right-[9px] top-[9px] size-[6px] rounded-full bg-brand-red ring-2 ring-panel"
                />
              ) : (
                <span className="flex h-[18px] min-w-6 items-center justify-center rounded-6 bg-control px-[6px] text-[10px] font-semibold text-sub">
                  {count}
                </span>
              ))}
          </>
        )}
      </NavLink>
    );
    return (
      <li key={section} className={collapsed ? 'flex justify-center' : undefined}>
        {collapsed ? (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                sideOffset={10}
                className="rounded-8 border border-line bg-popover px-[10px] py-[6px] text-[12px] font-medium text-text shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
              >
                {label}
                {count ? ` · ${count}` : ''}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : (
          link
        )}
      </li>
    );
  };

  const divider = <div className={`my-3 h-px bg-line ${collapsed ? 'mx-1' : 'mx-1'}`} />;

  return (
    <aside
      className={`flex h-full flex-col rounded-[16px] border border-line bg-panel py-[11px] shadow-[0_4px_10px_rgba(0,0,0,0.12)] transition-[width] ${
        collapsed ? 'w-16 px-[11px]' : 'w-[224px] px-[9px]'
      }`}
    >
      <div className={`flex h-12 items-center gap-2 ${collapsed ? 'justify-center' : 'px-2'}`}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-8 bg-brand-red text-[#FFFFFF]">
          <EmblemIcon size={18} />
        </span>
        {!collapsed && (
          <span className="leading-none">
            <span className="block text-[13px] font-semibold tracking-[-0.1px] text-text">
              {t('shell.orgShort')}
            </span>
            <span className="mt-[3px] block text-[10.5px] tracking-[0.2px] text-dim">
              {workDomain}
            </span>
          </span>
        )}
      </div>
      {divider}

      <nav aria-label={t('shell.mainNav')} className="flex flex-1 flex-col">
        <ul className="flex flex-col gap-1">{mainItems.map(renderItem)}</ul>
        {adminItems.some((i) => canOpen(i.section)) && (
          <>
            {divider}
            <ul className="flex flex-col gap-1">{adminItems.map(renderItem)}</ul>
          </>
        )}
      </nav>

      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? t('shell.expand') : undefined}
        aria-expanded={!collapsed}
        className={`flex items-center rounded-9 text-[12.5px] tracking-[-0.1px] text-faint hover:bg-row-highlight hover:text-sub ${
          collapsed ? 'mx-auto size-10 justify-center' : 'h-10 gap-3 px-3'
        }`}
      >
        {collapsed ? <SidebarExpandIcon size={18} /> : <SidebarCollapseIcon size={18} />}
        {!collapsed && t('shell.collapse')}
      </button>
      {divider}

      <div className={`flex h-11 items-center gap-2 ${collapsed ? 'justify-center' : 'px-2'}`}>
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-control text-[11px] font-semibold text-info">
          {user ? initials(user.name) : ''}
        </span>
        {!collapsed && user && (
          <span className="min-w-0 leading-none">
            <span className="block truncate text-[11.5px] font-medium tracking-[-0.1px] text-text">
              {user.name}
            </span>
            <span className="mt-[3px] block truncate text-[10px] text-faint">{user.position}</span>
          </span>
        )}
      </div>
    </aside>
  );
}
