import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCan, useSession } from '@/features/auth';
import { useChatUnread } from '@/features/chat/api';
import { Avatar } from '@/features/knowledge-base/parts';
import {
  type NotificationView,
  notificationKinds,
  useOpenNotification,
  useVisibleNotifications,
} from '@/features/notifications/parts';
import { mockAbsences } from '@/features/tasks/absences';
import { useMailQueueSummary, useTasks } from '@/features/tasks/api';
import { DueChips } from '@/features/tasks/board/TaskCard';
import { currentUserId } from '@/features/tasks/directory';
import type { Task } from '@/features/tasks/types';
import { formatIsoDate, relativeShort } from '@/shared/lib/date';
import { todayInBishkek } from '@/shared/lib/workDays';
import {
  ArrowRightIcon,
  BoltSmallIcon,
  CalendarMediumIcon,
  ChatIcon,
  ClockIcon,
  MailLargeIcon,
  PlaneIcon,
  TasksIcon,
} from '@/shared/ui/icons';
import {
  type DashboardSummary,
  dashboardSummary,
  nextHoliday,
  partOfDay,
  todayKind,
  workMonth,
} from './summary';

/** Сколько моих задач видно на рабочем столе; остальные — по ссылке «Все задачи» */
const MY_TASKS_SHOWN = 6;
const NOTIFICATIONS_SHOWN = 4;

const panel = 'rounded-14 border border-line bg-panel';

/**
 * Рабочий стол: что требует внимания сегодня — мои задачи, эскалации, уведомления,
 * кто в отпуске, рабочие дни месяца. Макета нет: собран из блоков других разделов.
 * Блоки разделов без права не показываются.
 */
export function DashboardPage() {
  const { can } = useCan();
  const canTasks = can('tasks.view');
  const tasks = useTasks('department');
  const today = todayInBishkek();
  const summary = dashboardSummary(tasks.data ?? [], mockAbsences(today), currentUserId, today);

  return (
    <div className="flex flex-col gap-[14px] pb-2 leading-[normal]">
      <Greeting />
      {canTasks && <Stats summary={summary} loading={tasks.isPending} />}
      <div className="grid gap-[14px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-[14px]">
          {canTasks && <MyTasks summary={summary} loading={tasks.isPending} />}
          {canTasks && summary.escalations.length > 0 && (
            <Escalations tasks={summary.escalations} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-[14px]">
          <Notifications />
          <Absences summary={summary} />
        </div>
      </div>
    </div>
  );
}

function Greeting() {
  const { t, i18n } = useTranslation();
  const user = useSession().data?.user;
  const today = todayInBishkek();
  const month = workMonth(today);
  const holiday = nextHoliday(today);
  const kind = todayKind(today);
  const firstName = user?.name.split(' ')[0];

  return (
    <section className={`${panel} flex flex-wrap items-center justify-between gap-4 px-6 py-5`}>
      <div className="min-w-0">
        <h2 className="text-[20px] font-semibold tracking-[-0.4px] text-text">
          {t(`dashboard.greeting.${partOfDay()}`, { name: firstName })}
        </h2>
        <p className="mt-[6px] text-[12.5px] text-faint">
          {/* Дата и департамент — уже в шапке */}
          {t(`dashboard.dayKind.${kind}`)}
          {' · '}
          {t('dashboard.workDaysLeft', { count: month.left, total: month.total })}
        </p>
      </div>
      {holiday && (
        <p className="flex items-center gap-2 rounded-9 border border-line bg-surface px-3 py-2 text-[12px] text-sub">
          <CalendarMediumIcon size={16} className="text-brand-gold" />
          <span>
            {t('dashboard.nextHoliday', {
              name: t(`holidays.${holiday.holiday}`),
              date: formatIsoDate(holiday.date, 'd MMMM', i18n.language),
            })}
            <span className="text-dim"> · {t('dashboard.inDays', { count: holiday.days })}</span>
          </span>
        </p>
      )}
    </section>
  );
}

type StatProps = {
  Icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number | undefined;
  to: string;
  /** Подсветка, если значение не ноль */
  tone?: 'danger' | 'warning' | 'info';
};

const statTone: Record<NonNullable<StatProps['tone']>, string> = {
  danger: 'text-danger',
  warning: 'text-warning-text',
  info: 'text-info',
};

function Stat({ Icon, label, value, to, tone }: StatProps) {
  const highlighted = tone && value ? statTone[tone] : 'text-text';
  return (
    <Link
      to={to}
      className={`${panel} group flex min-w-0 flex-col gap-3 px-[18px] py-4 transition-colors hover:border-info-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-info`}
    >
      <span className="flex items-center gap-2 text-[12px] text-faint">
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className={`text-[26px] font-semibold tracking-[-0.6px] ${highlighted}`}>
        {value ?? '—'}
      </span>
    </Link>
  );
}

function Stats({ summary, loading }: { summary: DashboardSummary; loading: boolean }) {
  const { t } = useTranslation();
  const { can } = useCan();
  const queue = useMailQueueSummary().data;
  const chatUnread = useChatUnread();
  const value = (n: number) => (loading ? undefined : n);

  return (
    <section
      aria-label={t('dashboard.stats')}
      className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[14px]"
    >
      <Stat
        Icon={TasksIcon}
        label={t('dashboard.myTasks')}
        value={value(summary.mine.length)}
        to="/tasks"
      />
      <Stat
        Icon={ClockIcon}
        label={t('dashboard.overdue')}
        value={value(summary.overdue.length)}
        to="/tasks"
        tone="danger"
      />
      <Stat
        Icon={BoltSmallIcon}
        label={t('dashboard.soon')}
        value={value(summary.soon.length)}
        to="/tasks"
        tone="warning"
      />
      {can('tasks.create') && (
        <Stat
          Icon={MailLargeIcon}
          label={t('dashboard.mailQueue')}
          value={queue && queue.ready + queue.manual}
          to="/tasks?queue=1"
          tone="warning"
        />
      )}
      {can('chat.use') && (
        <Stat
          Icon={ChatIcon}
          label={t('dashboard.chatUnread')}
          value={chatUnread}
          to="/chat"
          tone="info"
        />
      )}
    </section>
  );
}

function PanelHeader({
  title,
  count,
  link,
}: {
  title: string;
  count?: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-[18px] pb-2 pt-4">
      <h2 className="flex items-baseline gap-2 text-[13.5px] font-semibold tracking-[-0.2px] text-text">
        {title}
        {count && <span className="text-[11px] font-medium text-dim">{count}</span>}
      </h2>
      {link && (
        <Link
          to={link.to}
          className="flex items-center gap-[6px] text-[12px] font-medium text-info hover:underline"
        >
          {link.label}
          <ArrowRightIcon size={14} />
        </Link>
      )}
    </div>
  );
}

function TaskRow({ task, children }: { task: Task; children?: ReactNode }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        to={`/tasks?task=${task.id}`}
        className="flex items-center gap-3 px-[18px] py-[11px] hover:bg-row-highlight focus-visible:bg-row-highlight focus-visible:outline-none"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] tracking-[-0.1px] text-text">{task.title}</p>
          <p className="mt-[3px] truncate text-[11px] text-dim">
            {task.code}
            {task.project && ` · ${task.project.name}`}
          </p>
        </div>
        {children}
        <span className="flex shrink-0 items-center gap-[5px]">
          <DueChips task={task} />
        </span>
      </Link>
    </li>
  );
}

function MyTasks({ summary, loading }: { summary: DashboardSummary; loading: boolean }) {
  const { t } = useTranslation();
  const shown = summary.mine.slice(0, MY_TASKS_SHOWN);
  const total = summary.mine.length;

  return (
    <section className={panel} aria-label={t('dashboard.myTasks')}>
      <PanelHeader
        title={t('dashboard.myTasks')}
        count={
          loading
            ? undefined
            : total > shown.length
              ? t('dashboard.shownOf', { shown: shown.length, total })
              : String(total)
        }
        link={{ to: '/tasks', label: t('dashboard.allTasks') }}
      />
      {loading ? (
        <p className="px-[18px] pb-5 pt-2 text-[12.5px] text-dim">{t('dashboard.loading')}</p>
      ) : total === 0 ? (
        <p className="px-[18px] pb-5 pt-2 text-[12.5px] text-dim">{t('dashboard.noTasks')}</p>
      ) : (
        <ul className="pb-[6px]">
          {shown.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
      {summary.toReview.length > 0 && (
        <p className="border-t border-line px-[18px] py-3 text-[12px] text-faint">
          {t('dashboard.toReview', { count: summary.toReview.length })}
        </p>
      )}
    </section>
  );
}

function Escalations({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation();
  return (
    <section
      className={`${panel} relative overflow-hidden`}
      aria-label={t('dashboard.escalations')}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
      <PanelHeader title={t('dashboard.escalations')} count={String(tasks.length)} />
      <p className="px-[18px] pb-2 text-[11.5px] text-faint">{t('dashboard.escalationsHint')}</p>
      <ul className="pb-[6px]">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task}>
            {task.assignee && (
              <span className="flex shrink-0 items-center gap-[6px] text-[11.5px] text-sub">
                <Avatar person={task.assignee} size={20} />
                {task.assignee.short}
              </span>
            )}
          </TaskRow>
        ))}
      </ul>
    </section>
  );
}

function Notifications() {
  const { t } = useTranslation();
  const open = useOpenNotification();
  const unread = useVisibleNotifications().filter((n) => !n.read);
  const shown = unread.slice(0, NOTIFICATIONS_SHOWN);

  return (
    <section className={panel} aria-label={t('notifications.title')}>
      <PanelHeader
        title={t('notifications.title')}
        count={
          unread.length > shown.length
            ? t('dashboard.shownOf', { shown: shown.length, total: unread.length })
            : String(unread.length)
        }
        link={{ to: '/notifications', label: t('dashboard.all') }}
      />
      {shown.length === 0 ? (
        <p className="px-[18px] pb-5 pt-2 text-[12.5px] text-dim">{t('shell.noNotifications')}</p>
      ) : (
        <ul className="pb-[6px]">
          {shown.map((n) => (
            <NotificationRow key={n.id} n={n} onOpen={() => open(n)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NotificationRow({ n, onOpen }: { n: NotificationView; onOpen: () => void }) {
  const { t } = useTranslation();
  const kind = notificationKinds[n.kind];
  const content = (
    <>
      <span className={`mt-[1px] shrink-0 ${kind.color}`}>
        <kind.Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-text">{n.shownTitle}</span>
        <span className="mt-[2px] block truncate text-[11px] text-faint">{n.shownText}</span>
      </span>
      <span className="shrink-0 text-[10.5px] text-dim">{relativeShort(n.at, t)}</span>
    </>
  );
  const row = 'flex w-full items-start gap-[10px] px-[18px] py-[10px] text-left';
  return (
    <li className="border-t border-line first:border-t-0">
      {n.target ? (
        <button type="button" onClick={onOpen} className={`${row} hover:bg-row-highlight`}>
          {content}
        </button>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}

function Absences({ summary }: { summary: DashboardSummary }) {
  const { t, i18n } = useTranslation();
  const date = (d: string) => formatIsoDate(d, 'd MMM', i18n.language).replace('.', '');
  const groups = [
    { key: 'now', items: summary.absentNow },
    { key: 'soon', items: summary.absentSoon },
  ] as const;

  return (
    <section className={panel} aria-label={t('dashboard.absences')}>
      <PanelHeader
        title={t('dashboard.absences')}
        count={String(summary.absentNow.length + summary.absentSoon.length)}
      />
      {summary.absentNow.length + summary.absentSoon.length === 0 ? (
        <p className="px-[18px] pb-5 pt-2 text-[12.5px] text-dim">{t('dashboard.noAbsences')}</p>
      ) : (
        <div className="flex flex-col gap-1 pb-3">
          {groups.map(
            ({ key, items }) =>
              items.length > 0 && (
                <div key={key}>
                  <h3 className="px-[18px] pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-dim">
                    {t(`dashboard.absent.${key}`)}
                  </h3>
                  <ul>
                    {items.map((a) => (
                      <li
                        key={`${a.person.id}-${a.from}`}
                        className="flex items-center gap-[10px] px-[18px] py-2"
                      >
                        <Avatar person={a.person} size={24} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] text-text">{a.person.name}</p>
                          <p className="truncate text-[11px] text-faint">
                            {key === 'now'
                              ? t('dashboard.absentUntil', { date: date(a.to) })
                              : t('dashboard.absentFrom', { from: date(a.from), to: date(a.to) })}
                            {' · '}
                            {t('dashboard.deputy', { name: a.deputy.short })}
                          </p>
                        </div>
                        <PlaneIcon size={12} className="shrink-0 text-info" />
                      </li>
                    ))}
                  </ul>
                </div>
              ),
          )}
        </div>
      )}
    </section>
  );
}
