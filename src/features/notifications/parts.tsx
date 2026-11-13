import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCan } from '@/features/auth';
import { useMailQueueSummary, useTasks } from '@/features/tasks/api';
import { formatIsoDate } from '@/shared/lib/date';
import { toast } from '@/shared/lib/toast';
import { diffDays, todayInBishkek } from '@/shared/lib/workDays';
import {
  AtSignIcon,
  BellIcon,
  BoltIcon,
  CheckSmallIcon,
  ClockIcon,
  MailIcon,
  TasksIcon,
} from '@/shared/ui/icons';
import {
  type AppNotification,
  canSeeNotification,
  type NotificationKind,
  useMarkRead,
  useNotifications,
} from './api';

/** Иконка, цвет и полоса непрочитанного — по виду уведомления, как в макете */
export const notificationKinds: Record<
  NotificationKind,
  { Icon: ComponentType<{ size?: number }>; stripe: string; color: string }
> = {
  assigned: { Icon: TasksIcon, stripe: 'bg-info', color: 'text-info' },
  escalation: { Icon: BoltIcon, stripe: 'bg-warning', color: 'text-warning' },
  overdue: { Icon: ClockIcon, stripe: 'bg-brand-red', color: 'text-brand-red' },
  mailQueue: { Icon: MailIcon, stripe: 'bg-brand-gold', color: 'text-brand-gold' },
  mention: { Icon: AtSignIcon, stripe: 'bg-info', color: 'text-info' },
  reminder: { Icon: BellIcon, stripe: 'bg-sub', color: 'text-faint' },
  done: { Icon: CheckSmallIcon, stripe: 'bg-success', color: 'text-success' },
};

export type NotificationView = AppNotification & { shownTitle: string; shownText: string };

/**
 * Заголовок и текст на языке интерфейса: по params от сервера (`notifications.titles.*`,
 * `notifications.texts.*`); без params — как прислал сервер.
 */
function translated(
  n: AppNotification,
  t: (key: string, options?: Record<string, unknown>) => string,
  language: string,
): { title: string; text: string } {
  const p = n.params;
  if (!p) return { title: n.title, text: n.text };
  const date =
    typeof p.date === 'string' && p.date ? formatIsoDate(p.date, 'd MMMM', language) : '';
  const values = { ...p, date };
  switch (n.kind) {
    case 'assigned':
      return {
        title: t('notifications.titles.assigned', values),
        text: [
          p.actor ? t('notifications.texts.assignedBy', values) : '',
          date ? t('notifications.texts.due', values) : '',
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'escalation':
      return {
        title: t('notifications.titles.escalation', values),
        text: t('notifications.texts.escalation', { ...values, count: Number(p.hours) }),
      };
    case 'overdue':
      return {
        title: t('notifications.titles.overdue', values),
        text: t(
          `notifications.texts.overdue_${p.role === 'author' ? 'author' : 'assignee'}`,
          values,
        ),
      };
    case 'mention':
      return {
        title: t('notifications.titles.mention', values),
        text: t('notifications.texts.mention', values),
      };
    case 'reminder':
      return { title: t('notifications.titles.reminder', values), text: n.text };
    case 'done':
      return {
        title: t('notifications.titles.done', values),
        text: p.actor ? t('notifications.texts.done', values) : '',
      };
    default:
      return { title: n.title, text: n.text };
  }
}

/**
 * Уведомления для показа. Письма в очереди считаются по самой очереди: пустая очередь —
 * уведомления нет вовсе (ни в ленте, ни в счётчиках). Напоминание — с датой срока.
 */
export function useVisibleNotifications(): NotificationView[] {
  const { t, i18n } = useTranslation();
  const { can } = useCan();
  const data = (useNotifications().data ?? []).filter((n) => canSeeNotification(n, can));
  const queue = useMailQueueSummary().data;
  const queueCount = queue ? queue.ready + queue.manual : 0;
  const today = todayInBishkek();

  return data.flatMap((raw): NotificationView[] => {
    const shown = translated(raw, t, i18n.language);
    const n = { ...raw, title: shown.title, text: shown.text };
    if (n.kind === 'mailQueue') {
      if (queueCount === 0) return [];
      return [
        {
          ...n,
          shownTitle: t('mailQueue.mailQueueNote', { count: queueCount }),
          // Текст — по самой очереди, как в баннере на доске задач
          shownText: t('mailQueue.subtitle', { mailbox: 'info@olympic.kg', ...queue }),
        },
      ];
    }
    if (n.kind === 'reminder') {
      const days = diffDays(today, n.text);
      const date = formatIsoDate(n.text, 'd MMMM', i18n.language);
      return [
        {
          ...n,
          shownTitle: n.title,
          shownText:
            days <= 0
              ? t('notifications.reminderToday', { date })
              : t('notifications.reminderText', { count: days, date }),
        },
      ];
    }
    return [{ ...n, shownTitle: n.title, shownText: n.text }];
  });
}

/** Подпись кнопки уведомления; null — кнопки нет */
export function actionLabel(n: AppNotification, t: (key: string) => string): string | null {
  switch (n.target?.kind) {
    case 'task':
      return t('notifications.openTask');
    case 'mailQueue':
      return t('notifications.review');
    case 'chat':
      // Упоминают в каналах департаментов; личная переписка — «Открыть переписку»
      return n.kind === 'mention' ? t('notifications.openChannel') : t('notifications.openChat');
    default:
      return null;
  }
}

/** Открыть то, о чём уведомление, и отметить его прочитанным */
export function useOpenNotification() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const markRead = useMarkRead();
  const tasks = useTasks('department').data;

  return (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    const target = n.target;
    if (!target) return;
    if (target.kind === 'mailQueue') navigate('/tasks?queue=1');
    else if (target.kind === 'chat') navigate(`/chat?c=${target.chatId}`);
    else {
      // Доска ещё грузится — открываем по id; загружена и задачи нет — её закрыли
      if (!tasks || tasks.some((x) => x.id === target.taskId)) {
        navigate(`/tasks?task=${target.taskId}`);
      } else toast.info({ title: t('notifications.taskGone') });
    }
  };
}
