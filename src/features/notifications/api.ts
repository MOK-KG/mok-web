import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChatUnread } from '@/features/chat/api';
import { addDays, todayInBishkek } from '@/shared/lib/workDays';

/**
 * Уведомления. Файл продублирован в web/ и mobile/ — правьте оба.
 * Доставка, пуши и эскалация по статусу «не открыто» — на стороне платформы.
 */
export type NotificationKind =
  | 'escalation'
  | 'overdue'
  | 'mailQueue'
  | 'mention'
  | 'reminder'
  | 'done';

export const notificationKinds: NotificationKind[] = [
  'escalation',
  'overdue',
  'mailQueue',
  'mention',
  'reminder',
  'done',
];

/** Куда ведёт кнопка уведомления */
export type NotificationTarget =
  | { kind: 'task'; taskTitle: string }
  | { kind: 'mailQueue' }
  | { kind: 'chat'; chatId: string };

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  text: string;
  /** ISO-время события */
  at: string;
  read: boolean;
  target: NotificationTarget | null;
};

/** Какие уведомления получать; эскалацию выключить нельзя — это правило платформы */
export type NotificationSettings = Record<NotificationKind, boolean>;

/**
 * ЗАГЛУШКА уведомлений до появления бэкенда: тексты из макета, время — относительно «сейчас»,
 * задачи — из заглушки задач (эскалация, просрочка, срок через два дня).
 * Данные вымышленные (см. CLAUDE.md, раздел «Данные»).
 */
function createMockNotifications(now = Date.now()): AppNotification[] {
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
  const reminderDue = addDays(todayInBishkek(), 2);
  return [
    {
      id: 'n1',
      kind: 'escalation',
      title: 'Эскалация · «Перевод устава на кыргызский»',
      text: 'Уведомление не открыто 4 часа. Передано директору департамента.',
      at: minutesAgo(12),
      read: false,
      target: { kind: 'task', taskTitle: 'Перевод устава на кыргызский язык' },
    },
    {
      id: 'n2',
      kind: 'overdue',
      title: 'Срок истёк · «Ответить на запрос МОК»',
      text: 'Просрочено на 1 день. Вы — исполнитель.',
      at: minutesAgo(60),
      read: false,
      target: { kind: 'task', taskTitle: 'Ответить на запрос МОК по антидопинговой программе' },
    },
    {
      id: 'n3',
      kind: 'mailQueue',
      title: '4 письма в очереди из почты',
      text: 'info@olympic.kg · ждут проверки перед созданием задач.',
      at: minutesAgo(120),
      read: false,
      target: { kind: 'mailQueue' },
    },
    {
      id: 'n4',
      kind: 'mention',
      title: 'Д. Токтосунова упомянула вас в чате',
      text: 'Канал «Медицинский» — нужен комментарий по статье 4.2 сметы.',
      at: minutesAgo(180),
      read: false,
      target: { kind: 'chat', chatId: 'c-medical' },
    },
    {
      id: 'n5',
      kind: 'reminder',
      title: 'Напоминание · «Обновить регламент аккредитации»',
      // Дата — в тексте сразу: срок задачи через два дня (заглушка задач, dueIn 2)
      text: reminderDue,
      at: minutesAgo(24 * 60),
      read: true,
      target: { kind: 'task', taskTitle: 'Обновить регламент аккредитации журналистов' },
    },
    {
      id: 'n6',
      kind: 'done',
      title: '«Квартальный отчёт для ОКС» завершён',
      text: 'К. Асанов перевёл задачу в «Готово».',
      at: minutesAgo(26 * 60),
      read: true,
      target: null,
    },
  ];
}

let mockNotifications = createMockNotifications();
let mockSettings: NotificationSettings = Object.fromEntries(
  notificationKinds.map((k) => [k, true]),
) as NotificationSettings;

/** Сброс заглушки (для тестов) */
export function resetNotificationsMock(now?: number) {
  mockNotifications = createMockNotifications(now);
  mockSettings = Object.fromEntries(
    notificationKinds.map((k) => [k, true]),
  ) as NotificationSettings;
}

const key = ['notifications'] as const;

/** Уведомления по настройкам: выключенные виды не приходят и не считаются */
export function useNotifications() {
  return useQuery({
    queryKey: key,
    queryFn: async () => mockNotifications.filter((n) => mockSettings[n.kind]),
  });
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      mockNotifications = mockNotifications.map((n) => ({ ...n, read: true }));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

/** Прочитать одно уведомление — при переходе по его кнопке */
export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      mockNotifications = mockNotifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: [...key, 'settings'],
    queryFn: async () => ({ ...mockSettings }),
  });
}

export function useSaveNotificationSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (settings: NotificationSettings) => {
      mockSettings = { ...settings, escalation: true };
    },
    meta: { successMessage: 'notifications.settingsSaved' },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

/** Счётчики меню: непрочитанные в чате — из чата; документы — ЗАГЛУШКА до раздела */
export function useNavCounters(): Partial<Record<'chat' | 'documents', number>> {
  const chat = useChatUnread();
  return { chat: chat || undefined, documents: 6 };
}
