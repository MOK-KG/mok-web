import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksKey } from '@/features/tasks/api';
import { api } from '@/shared/api/client';

/**
 * Ассистент в чате — личный разговор сотрудника с ИИ (mok-backend, apps/assistant/bot.py,
 * /api/assistant/bot). Права — сотрудника: ассистент читает только то, что видит он сам, а всё,
 * что меняет данные (задача, комментарий, сообщение, событие), приходит карточкой — выполняется
 * только кнопкой «Создать». Ответ считается на сервере в фоне: пока ждём, разговор опрашивается.
 * В тестах — подставной сервер testing/server.ts.
 */

export type BotActionKind = 'create_task' | 'update_task' | 'comment' | 'message' | 'event';
export type BotActionStatus = 'pending' | 'done' | 'cancelled' | 'failed';

/** Поле карточки: key — подпись (assistant.bot.field.*), value — значение по-русски с сервера */
export type BotField = { key: string; value: string };

export type BotAction = {
  id: string;
  kind: BotActionKind;
  status: BotActionStatus;
  preview: { title: string; fields: BotField[]; warnings: string[] };
  /** done: задача {taskId, code, title}; сообщение {chatId, peer}; событие {eventId, date, …} */
  result: {
    taskId?: string;
    code?: string;
    title?: string;
    chatId?: string;
    peer?: string;
    eventId?: string;
    date?: string;
    googleLink?: string;
    googleError?: string;
  };
  error: string;
  decidedAt: string | null;
};

export type BotSource = {
  /** memory — заметки ассистента (личный документ в базе знаний) */
  kind: 'article' | 'task' | 'web' | 'memory';
  title: string;
  url: string;
};

export type BotMessage = {
  id: number;
  role: 'user' | 'assistant' | 'action';
  text: string;
  /** Вопрос сотрудника: pending/processing — ассистент думает, failed — error */
  status: 'pending' | 'processing' | 'done' | 'failed';
  error: string;
  action: BotAction | null;
  sources: BotSource[];
  steps: { name: string; arguments: string }[];
  at: string;
};

/** Разговор в списке: «Новый разговор» начинает новый, прежние остаются */
export type BotConversationItem = { id: number; title: string; updatedAt: string };

export type BotConversation = {
  available: boolean;
  /** Открытый разговор; null — ещё ни одного */
  conversation: BotConversationItem | null;
  messages: BotMessage[];
  /** Заметки ассистента за месяц (память) — личный документ в базе знаний */
  notesUrl: string | null;
};

export const botKey = ['assistant', 'bot'] as const;
const conversationsKey = [...botKey, 'conversations'] as const;

/** id — открыть разговор; без id — последний */
export const fetchBot = (conversationId?: number | null) =>
  api.get<BotConversation>(
    conversationId ? `/assistant/bot?conversation=${conversationId}` : '/assistant/bot',
  );
export const fetchBotConversations = () =>
  api.get<BotConversationItem[]>('/assistant/bot/conversations');
export const newBotConversation = () =>
  api.post<BotConversationItem>('/assistant/bot/conversations', {});
export const sendToBot = ({ text, conversationId }: { text: string; conversationId?: number }) =>
  api.post<BotMessage & { conversationId: number }>('/assistant/bot', { text, conversationId });
export const decideBotAction = ({ id, decision }: { id: string; decision: 'confirm' | 'cancel' }) =>
  api.post<BotAction>(`/assistant/bot/actions/${id}/${decision}`, {});

/** Ассистент ещё отвечает: последний вопрос в очереди или в работе */
export const isThinking = (messages: BotMessage[]) =>
  messages.some((m) => m.role === 'user' && (m.status === 'pending' || m.status === 'processing'));

export function useBot(conversationId: number | null) {
  return useQuery({
    queryKey: [...botKey, 'conversation', conversationId ?? 'latest'],
    queryFn: () => fetchBot(conversationId),
    // Пока ассистент думает — часто, иначе редко (карточку могли решить в другой вкладке)
    refetchInterval: (query) =>
      query.state.data && isThinking(query.state.data.messages) ? 1_500 : 30_000,
  });
}

export const useBotConversations = () =>
  useQuery({ queryKey: conversationsKey, queryFn: fetchBotConversations });

export function useSendToBot() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: sendToBot,
    // Ошибку (лимит, занят) показывает поле ввода
    meta: { errorMessage: false },
    // Перечитать разговор (опрос включится, пока ассистент думает) и список разговоров
    onSuccess: () => client.invalidateQueries({ queryKey: botKey }),
  });
}

export function useNewBotConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: newBotConversation,
    onSuccess: () => client.invalidateQueries({ queryKey: botKey }),
  });
}

export function useDecideBotAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: decideBotAction,
    onSuccess: async (action) => {
      client.setQueriesData<BotConversation>({ queryKey: [...botKey, 'conversation'] }, (data) =>
        data
          ? {
              ...data,
              messages: data.messages.map((m) =>
                m.action?.id === action.id ? { ...m, action } : m,
              ),
            }
          : data,
      );
      if (action.status !== 'done') return;
      // Выполненное действие меняет задачи, чаты или календарь — перечитываем их
      await Promise.all([
        client.invalidateQueries({ queryKey: tasksKey }),
        client.invalidateQueries({ queryKey: ['chat'] }),
        client.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
    },
  });
}
