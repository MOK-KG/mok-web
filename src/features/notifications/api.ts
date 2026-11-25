import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChatUnread } from '@/features/chat/api';
import { useAwaitingResolution } from '@/features/documents/api';
import { api } from '@/shared/api/client';
import type { Permission } from '@/shared/config/permissions';

/**
 * Уведомления — API бэкенда (mok-backend, apps/notifications, /api/notifications/).
 * Создаёт их сервер: назначение задачи, «готово», письма в очереди, упоминание в чате;
 * напоминания, просрочки и эскалации — периодическая проверка (run_scheduler).
 * В тестах — подставной сервер testing/server.ts. Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type NotificationKind =
  | 'assigned'
  | 'escalation'
  | 'overdue'
  | 'mailQueue'
  | 'mention'
  | 'reminder'
  | 'done'
  | 'pendingUser'
  | 'followUp';

export const notificationKinds: NotificationKind[] = [
  'assigned',
  'escalation',
  'overdue',
  'mailQueue',
  'mention',
  'reminder',
  'done',
  'pendingUser',
  'followUp',
];

/** Не выключаются: эскалация считается по непрочитанному назначению — правило платформы */
export const lockedNotificationKinds: NotificationKind[] = ['assigned', 'escalation'];

/** Куда ведёт кнопка уведомления */
export type NotificationTarget =
  | { kind: 'task'; taskId: string; taskTitle: string }
  | { kind: 'mailQueue' }
  | { kind: 'chat'; chatId: string }
  | { kind: 'staff'; staffId: string };

/** Подстановки для перевода заголовка и текста (task, actor, date, hours, chat…) */
export type NotificationParams = Record<string, string | number | boolean>;

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  /** Заголовок и текст по-русски от сервера; на других языках — по params */
  title: string;
  text: string;
  params: NotificationParams | null;
  /** ISO-время события */
  at: string;
  read: boolean;
  target: NotificationTarget | null;
};

/**
 * Видно ли уведомление при этих правах: только если можно открыть то, о чём оно.
 * Очередь из почты — тем, кто создаёт задачи; задачи — с доступом к задачам; чат — с чатом.
 * Иначе кнопка вела бы на экран 403, а счётчик считал бы недоступное. Сервер фильтрует так же.
 */
export function canSeeNotification(n: AppNotification, can: (p: Permission) => boolean) {
  switch (n.target?.kind) {
    case 'mailQueue':
      return can('tasks.create');
    case 'task':
      return can('tasks.view');
    case 'chat':
      return can('chat.use');
    case 'staff':
      return can('roles.assign');
    default:
      return n.kind !== 'done' || can('tasks.view');
  }
}

/** Какие уведомления получать; назначения и эскалацию выключить нельзя — правило платформы */
export type NotificationSettings = Record<NotificationKind, boolean>;

/** Уведомление в формате бэкенда (NotificationSerializer) */
export type ApiNotification = Omit<AppNotification, 'id' | 'params'> & {
  id: number;
  params: NotificationParams | null;
};

export const toNotification = (n: ApiNotification): AppNotification => ({
  ...n,
  id: String(n.id),
  params: n.params && Object.keys(n.params).length ? n.params : null,
});

export const notificationsKey = ['notifications'] as const;
const key = notificationsKey;

/** Свои уведомления; выключенные виды и недоступное по правам сервер не присылает */
export function useNotifications() {
  return useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<ApiNotification[]>('/notifications/')).map(toNotification),
    refetchInterval: 15_000,
  });
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

/** Прочитать одно уведомление — при переходе по его кнопке */
export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: [...key, 'settings'],
    queryFn: () => api.get<NotificationSettings>('/notifications/settings'),
  });
}

export function useSaveNotificationSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: NotificationSettings) =>
      api.put<NotificationSettings>('/notifications/settings', settings),
    meta: { successMessage: 'notifications.settingsSaved' },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

/** Счётчики меню: непрочитанные в чате; входящие, ждущие резолюции */
export function useNavCounters(): Partial<Record<'chat' | 'documents', number>> {
  const chat = useChatUnread();
  const documents = useAwaitingResolution();
  return { chat: chat || undefined, documents: documents || undefined };
}
