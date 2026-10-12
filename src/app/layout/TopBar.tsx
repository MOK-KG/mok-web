import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth';
import {
  type AppNotification,
  type NotificationKind,
  useMarkAllRead,
  useNotifications,
} from '@/features/notifications/api';
import { type Language, languageLabels, languages } from '@/shared/config/i18n';
import { formatIsoDate, relativeShort } from '@/shared/lib/date';
import { todayInBishkek } from '@/shared/lib/workDays';
import {
  AtSignIcon,
  BellIcon,
  BoltIcon,
  CheckDoubleIcon,
  CheckIcon,
  CheckSmallIcon,
  ChevronDownIcon,
  ClockIcon,
  MailIcon,
  MoonIcon,
  SettingsIcon,
} from '@/shared/ui/icons';
import { type ThemeMode, useTheme } from '../providers/ThemeProvider';

const control =
  'flex h-8 items-center justify-center rounded-9 border border-line bg-control text-sub transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-info data-[state=open]:text-text';

const menuContent =
  'z-50 rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]';

const menuItem =
  'flex h-[34px] cursor-pointer items-center gap-2 rounded-[7px] px-3 text-[12px] tracking-[-0.1px] text-sub outline-none data-[highlighted]:bg-popover-active data-[highlighted]:text-text data-[state=checked]:bg-popover-active data-[state=checked]:font-medium data-[state=checked]:text-text';

/** Шапка раздела: заголовок, подпись, уведомления, язык, тема */
export function TopBar({ title }: { title: string }) {
  const { i18n } = useTranslation();
  const user = useSession().data?.user;
  const today = formatIsoDate(todayInBishkek(), 'EEEE, d MMMM', i18n.language);
  const subtitle = [user?.department, today].filter(Boolean).join(' · ');

  return (
    <header className="flex h-14 items-center justify-between gap-4 rounded-14 border border-line bg-panel px-5 shadow-[0_2px_10px_rgba(10,22,40,0.05)]">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="text-[17px] font-semibold tracking-[-0.3px] text-text">{title}</h1>
        <span aria-hidden className="size-[3px] shrink-0 rounded-full bg-dim" />
        <p className="truncate text-[12px] tracking-[0.1px] text-faint">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <Notifications />
        <LanguageMenu />
        <ThemeMenu />
      </div>
    </header>
  );
}

const kinds: Record<
  NotificationKind,
  { Icon: ComponentType<{ size?: number }>; stripe: string; color: string }
> = {
  escalation: { Icon: BoltIcon, stripe: 'bg-warning', color: 'text-warning' },
  overdue: { Icon: ClockIcon, stripe: 'bg-brand-red', color: 'text-brand-red' },
  mailQueue: { Icon: MailIcon, stripe: 'bg-brand-gold', color: 'text-brand-gold' },
  mention: { Icon: AtSignIcon, stripe: 'bg-info', color: 'text-info' },
  done: { Icon: CheckSmallIcon, stripe: 'bg-success', color: 'text-success' },
};

function Notifications() {
  const { t } = useTranslation();
  const { data = [] } = useNotifications();
  const markAll = useMarkAllRead();
  const unread = data.filter((n) => !n.read).length;

  return (
    <Popover.Root>
      <Popover.Trigger
        className={`${control} relative w-8`}
        aria-label={`${t('shell.notifications')}${unread ? `, ${t('shell.unread', { count: unread })}` : ''}`}
      >
        <BellIcon size={16} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-[5px] top-[5px] size-[6.5px] rounded-full bg-brand-red ring-[1.5px] ring-panel"
          />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={10}
          className="z-50 w-[400px] overflow-hidden rounded-11 border border-line bg-popover shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-center justify-between px-4 py-[14px]">
            <div className="flex items-center gap-2">
              <h2 className="text-[13.5px] font-semibold tracking-[-0.1px] text-text">
                {t('shell.notifications')}
              </h2>
              {unread > 0 && (
                <span className="rounded-6 bg-brand-red px-[7px] py-[2px] text-[10px] font-semibold text-[#FFFFFF]">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-[11px] font-medium text-info hover:underline"
              >
                <CheckDoubleIcon size={14} />
                {t('shell.readAll')}
              </button>
            )}
          </div>
          <ul className="max-h-[420px] overflow-y-auto border-y border-line">
            {data.length === 0 && (
              <li className="px-4 py-6 text-center text-[12px] text-faint">
                {t('shell.noNotifications')}
              </li>
            )}
            {data.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </ul>
          <button
            type="button"
            className="m-[10px] flex items-center gap-2 rounded-6 px-[5px] py-[6px] text-[11.5px] text-sub hover:text-text"
          >
            <SettingsIcon size={16} />
            {t('shell.notificationSettings')}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NotificationRow({ notification: n }: { notification: AppNotification }) {
  const { t } = useTranslation();
  const kind = kinds[n.kind];
  return (
    <li
      className={`relative flex gap-2 border-b border-line px-4 py-[14px] last:border-b-0 ${
        n.read ? '' : 'bg-row-highlight'
      }`}
    >
      {!n.read && (
        <span aria-hidden className={`absolute inset-y-0 left-0 w-[2.5px] ${kind.stripe}`} />
      )}
      <span className={`flex size-[22px] shrink-0 items-center justify-center ${kind.color}`}>
        <kind.Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium leading-4 tracking-[-0.1px] text-text">{n.title}</p>
        <p className="mt-[2px] text-[11px] leading-4 text-faint">{n.text}</p>
      </div>
      <time dateTime={n.at} className="shrink-0 text-[10px] text-dim">
        {relativeShort(n.at, t)}
      </time>
    </li>
  );
}

function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'ru') as Language;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`${control} w-[58px] gap-2`}
        aria-label={t('shell.language')}
      >
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.3px] text-text">
          {current}
        </span>
        <ChevronDownIcon size={13} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={10} className={`${menuContent} w-[180px]`}>
          <DropdownMenu.RadioGroup
            value={current}
            onValueChange={(lng) => i18n.changeLanguage(lng)}
          >
            {languages.map((lng) => (
              <DropdownMenu.RadioItem key={lng} value={lng} className={menuItem}>
                <span className="flex-1">{languageLabels[lng]}</span>
                <span className="w-6 text-[10px] uppercase tracking-[0.3px] text-dim">{lng}</span>
                <DropdownMenu.ItemIndicator className="text-brand-gold">
                  <CheckIcon size={14} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ThemeMenu() {
  const { t } = useTranslation();
  const { mode, theme, setMode } = useTheme();
  const options: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: t('settings.dark') },
    { value: 'light', label: t('settings.light') },
    { value: 'system', label: t('shell.themeSystem') },
  ];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`${control} w-8 ${theme === 'dark' ? '!text-brand-gold' : '!text-warning'}`}
        aria-label={t('shell.theme')}
      >
        <MoonIcon size={16} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={10} className={`${menuContent} w-[196px]`}>
          <DropdownMenu.RadioGroup value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
            {options.map((o) => (
              <DropdownMenu.RadioItem key={o.value} value={o.value} className={menuItem}>
                <span className="flex-1">{o.label}</span>
                <DropdownMenu.ItemIndicator className="text-brand-gold">
                  <CheckIcon size={14} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
