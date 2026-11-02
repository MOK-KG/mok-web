import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { relativeShort } from '@/shared/lib/date';
import { BoltIcon, CheckDoubleIcon, CheckIcon, SettingsIcon, XIcon } from '@/shared/ui/icons';
import {
  notificationKinds as kindList,
  type NotificationSettings,
  useMarkAllRead,
  useNotificationSettings,
  useSaveNotificationSettings,
} from './api';
import {
  actionLabel,
  type NotificationView,
  notificationKinds,
  useOpenNotification,
  useVisibleNotifications,
} from './parts';

type Tab = 'all' | 'unread' | 'mentions';

const tabs: Tab[] = ['all', 'unread', 'mentions'];

const matches: Record<Tab, (n: NotificationView) => boolean> = {
  all: () => true,
  unread: (n) => !n.read,
  mentions: (n) => n.kind === 'mention',
};

/**
 * Лента уведомлений: все, непрочитанные, упоминания; справа — правило эскалации.
 * Вкладка и окно настроек — в адресе (?tab=unread, ?settings=1).
 */
export function NotificationsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (tabs.find((x) => x === params.get('tab')) ?? 'all') as Tab;
  const visible = useVisibleNotifications();
  const markAll = useMarkAllRead();
  const unread = visible.filter((n) => !n.read).length;
  const shown = visible.filter(matches[tab]);

  usePageSubtitle(unread > 0 ? t('chat.unread', { count: unread }) : t('chat.allRead'));

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  return (
    <div className="flex h-full min-h-[560px] flex-col leading-[normal]">
      <div className="flex h-10 shrink-0 items-center justify-between px-1">
        <div role="tablist" aria-label={t('notifications.title')} className="flex h-10 gap-6">
          {tabs.map((x) => {
            const selected = x === tab;
            return (
              <button
                key={x}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setParam('tab', x === 'all' ? null : x)}
                className={`relative flex items-center gap-[7px] px-[3px] text-[13px] ${
                  selected ? 'font-semibold text-text' : 'text-sub hover:text-text'
                }`}
              >
                {t(
                  `notifications.${x === 'all' ? 'all' : x === 'unread' ? 'unreadTab' : 'mentions'}`,
                )}
                <span
                  className={`text-[11px] font-medium ${selected ? 'text-brand-gold' : 'text-dim'}`}
                >
                  {visible.filter(matches[x]).length}
                </span>
                {selected && (
                  <span
                    aria-hidden
                    className="absolute inset-x-[3px] bottom-[4px] h-[2px] rounded-[1px] bg-brand-red"
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={unread === 0}
          onClick={() => markAll.mutate()}
          className="flex h-8 items-center gap-[7px] rounded-9 border border-info-line px-[11px] text-[12.5px] font-medium text-info hover:bg-info-chip disabled:opacity-50"
        >
          <CheckDoubleIcon size={16} />
          {t('notifications.readAll')}
        </button>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 gap-[14px]">
        <section
          role="tabpanel"
          aria-label={t('notifications.title')}
          className="flex min-w-0 flex-1 flex-col overflow-y-auto rounded-14 border border-line bg-panel"
        >
          {shown.length === 0 ? (
            <p className="px-6 py-12 text-center text-[12.5px] text-dim">
              {t(
                tab === 'unread'
                  ? 'notifications.emptyUnread'
                  : tab === 'mentions'
                    ? 'notifications.emptyMentions'
                    : 'notifications.empty',
              )}
            </p>
          ) : (
            <ul>
              {shown.map((n) => (
                <FeedItem key={n.id} notification={n} />
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setParam('settings', '1')}
            className="mx-[18px] mb-4 mt-[18px] flex items-center gap-2 self-start text-[12px] text-faint hover:text-text"
          >
            <SettingsIcon size={16} />
            {t('notifications.settings')}
          </button>
        </section>

        <aside className="w-[316px] shrink-0 rounded-14 border border-line bg-panel px-5 pt-[22px]">
          <h2 className="text-[10px] font-semibold uppercase tracking-[1.4px] text-dim">
            {t('notifications.ruleTitle')}
          </h2>
          <div className="mt-3 rounded-9 border border-line bg-surface px-[15px] pb-[10px] pt-3">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-text">
              <BoltIcon size={16} className="text-warning" />
              {t('notifications.ruleName')}
            </p>
            <ol className="mt-[9px] flex flex-col gap-[4px] text-[11px] leading-[15px] text-faint">
              {[1, 2, 3].map((i) => (
                <li key={i}>
                  {i}. {t(`notifications.ruleStep${i}`)}
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-5 text-[10.5px] leading-[15px] text-dim">
            {t('notifications.ruleNote')}
          </p>
        </aside>
      </div>

      <SettingsDialog
        open={params.get('settings') === '1'}
        onClose={() => setParam('settings', null)}
      />
    </div>
  );
}

function FeedItem({ notification: n }: { notification: NotificationView }) {
  const { t } = useTranslation();
  const kind = notificationKinds[n.kind];
  const open = useOpenNotification();
  const label = actionLabel(n, t);

  return (
    <li className="relative flex gap-[14px] border-b border-line px-[18px] py-[18px] last:border-b-0">
      {!n.read && (
        <span aria-hidden className={`absolute inset-y-0 left-0 w-[2.5px] ${kind.stripe}`} />
      )}
      <span className={`mt-[1px] flex size-5 shrink-0 items-center justify-center ${kind.color}`}>
        <kind.Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] tracking-[-0.1px] ${n.read ? 'text-sub' : 'font-medium text-text'}`}
        >
          {n.shownTitle}
          {!n.read && <span className="sr-only"> · {t('notifications.unreadTab')}</span>}
        </p>
        <p className="mt-1 text-[11.5px] leading-4 text-faint">{n.shownText}</p>
        {label && (
          <button
            type="button"
            onClick={() => open(n)}
            className={`mt-[10px] flex h-[22px] items-center rounded-6 border px-[10px] text-[11px] font-medium ${
              n.kind === 'mention'
                ? 'border-info-line text-info hover:bg-info-chip'
                : 'border-line text-sub hover:text-text'
            }`}
          >
            {label}
          </button>
        )}
      </div>
      <time dateTime={n.at} className="shrink-0 pr-5 text-[10.5px] text-dim">
        {relativeShort(n.at, t)}
      </time>
    </li>
  );
}

/** Какие уведомления получать. Эскалацию выключить нельзя — правило платформы */
function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const settings = useNotificationSettings().data;
  const save = useSaveNotificationSettings();
  const [draft, setDraft] = useState<NotificationSettings | null>(null);

  // Черновик — из сохранённых настроек при каждом открытии
  useEffect(() => {
    if (open && settings) setDraft(settings);
  }, [open, settings]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-18 border border-line bg-panel px-[23px] pb-[22px] pt-[21px] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <Dialog.Title className="pr-10 text-[17px] font-semibold tracking-[-0.3px] text-text">
            {t('notifications.settingsTitle')}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-[11.5px] leading-4 text-faint">
            {t('notifications.settingsHint')}
          </Dialog.Description>
          <ul className="mt-4 flex flex-col gap-[6px]">
            {kindList.map((k) => {
              const locked = k === 'escalation';
              const on = locked || !!draft?.[k];
              const { Icon, color } = notificationKinds[k];
              return (
                <li key={k}>
                  <label
                    className={`flex items-center gap-[10px] rounded-9 border border-line px-3 py-[9px] ${
                      locked ? 'cursor-default' : 'cursor-pointer hover:bg-row-highlight'
                    }`}
                  >
                    <span className={`flex size-5 items-center justify-center ${color}`}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-text">
                        {t(`notifications.kinds.${k}`)}
                      </span>
                      {locked && (
                        <span className="block text-[10.5px] text-dim">
                          {t('notifications.escalationLocked')}
                        </span>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={on}
                      checked={on}
                      disabled={locked}
                      onChange={(e) => draft && setDraft({ ...draft, [k]: e.target.checked })}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-info ${
                        on ? 'bg-info' : 'bg-chip'
                      } ${locked ? 'opacity-60' : ''}`}
                    >
                      <span
                        className={`absolute top-[2px] size-4 rounded-full bg-[#FFFFFF] transition-[left] ${
                          on ? 'left-[18px]' : 'left-[2px]'
                        }`}
                      />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 items-center rounded-9 border border-line px-3 text-[12.5px] font-medium text-sub hover:text-text"
            >
              {t('notifications.cancel')}
            </button>
            <button
              type="button"
              disabled={!draft || save.isPending}
              onClick={() =>
                draft &&
                save
                  .mutateAsync(draft)
                  .then(onClose)
                  .catch(() => null)
              }
              className="flex h-8 items-center gap-[6px] rounded-9 bg-brand-red px-3 text-[12.5px] font-semibold text-[#FFFFFF] hover:opacity-90 disabled:opacity-60"
            >
              <CheckIcon size={14} />
              {t('notifications.save')}
            </button>
          </div>
          <Dialog.Close
            aria-label={t('chat.close')}
            className="absolute right-[19px] top-[19px] flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
