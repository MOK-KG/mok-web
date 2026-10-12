import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type NotificationKind = 'escalation' | 'overdue' | 'mailQueue' | 'mention' | 'done';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  text: string;
  /** ISO-время события */
  at: string;
  read: boolean;
};

/**
 * ЗАГЛУШКА уведомлений до появления бэкенда: тексты из макета, время — относительно «сейчас».
 * Данные вымышленные (см. CLAUDE.md, раздел «Данные»).
 */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let mockNotifications: AppNotification[] = [
  {
    id: 'n1',
    kind: 'escalation',
    title: 'Эскалация · «Перевод устава на кыргызский»',
    text: 'Уведомление не открыто 4 часа. Передано директору департамента.',
    at: minutesAgo(12),
    read: false,
  },
  {
    id: 'n2',
    kind: 'overdue',
    title: 'Срок истёк · «Ответить на запрос МОК»',
    text: 'Просрочено на 1 день. Вы — исполнитель.',
    at: minutesAgo(60),
    read: false,
  },
  {
    id: 'n3',
    kind: 'mailQueue',
    title: '4 письма в очереди из почты',
    text: 'info@olympic.kg · ждут проверки перед созданием задач.',
    at: minutesAgo(120),
    read: false,
  },
  {
    id: 'n4',
    kind: 'mention',
    title: 'Д. Токтосунова упомянула вас',
    text: '«Смета на Азиатские игры 2026» — нужен ваш комментарий по статье 4.2.',
    at: minutesAgo(180),
    read: false,
  },
  {
    id: 'n5',
    kind: 'done',
    title: '«Квартальный отчёт для ОКС» завершён',
    text: 'К. Асанов перевёл задачу в «Готово».',
    at: minutesAgo(26 * 60),
    read: true,
  },
];

const key = ['notifications'] as const;

export function useNotifications() {
  return useQuery({ queryKey: key, queryFn: async () => mockNotifications });
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

/** ЗАГЛУШКА счётчиков меню (непрочитанные в чате, документы на исполнении) */
export function useNavCounters(): Partial<Record<'chat' | 'documents', number>> {
  return { chat: 3, documents: 6 };
}
