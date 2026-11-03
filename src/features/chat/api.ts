import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { absenceOf, isAbsentOn } from '@/features/tasks/absences';
import { todayInBishkek } from '@/shared/lib/workDays';
import { chatMembers, createMockChat, currentMemberId } from './mock';
import type { Chat, ChatMessage, ChatSummary } from './types';

/**
 * Данные чата. Пока бэкенда нет — заглушка в памяти (mock.ts); реальное время, доставка
 * и пуши — на стороне платформы. Когда появится API, меняются только функции, хуки остаются.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
let store = createMockChat();
let seq = 0;

// Без import.meta.env: файл общий для web и mobile (Expo), задержки короткие и в тестах
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Сброс заглушки (для тестов) */
export function resetChatMock(now?: number) {
  store = createMockChat(now);
}

/** Непрочитанные: чужие и системные сообщения после readAt */
const unreadOf = (chat: Chat) =>
  store.messages.filter(
    (m) => m.chatId === chat.id && m.authorId !== currentMemberId && m.at > chat.readAt,
  ).length;

export function fetchChats(): ChatSummary[] {
  return store.chats
    .map((chat) => {
      const own = store.messages.filter((m) => m.chatId === chat.id);
      // Последнее в ленте — без ответов в ветках, как в канале
      const last = own.filter((m) => !m.threadId).at(-1) ?? null;
      return structuredClone({ ...chat, last, unread: unreadOf(chat) });
    })
    .sort((a, b) => (b.last?.at ?? '').localeCompare(a.last?.at ?? ''));
}

export const fetchMessages = (chatId: string): ChatMessage[] =>
  structuredClone(store.messages.filter((m) => m.chatId === chatId));

/** Ветки ответов: ID сообщения → ответы по времени */
export function threadsOf(messages: ChatMessage[]): Map<string, ChatMessage[]> {
  const threads = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    if (!m.threadId) continue;
    const list = threads.get(m.threadId) ?? [];
    list.push(m);
    threads.set(m.threadId, list);
  }
  return threads;
}

/** Всего непрочитанных — для счётчика в меню и в шапке */
export const unreadTotal = () => store.chats.reduce((sum, c) => sum + unreadOf(c), 0);

const find = (chatId: string) => {
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) throw new Error('chat-not-found');
  return chat;
};

/** Файл из переписки — для раздела «Файлы» */
export type ChatFile = {
  messageId: string;
  chatId: string;
  chatTitle: string;
  name: string;
  ext: string;
  authorId: string | null;
  at: string;
};

/** Файлы из переписок, где пользователь участник */
export const fetchChatFiles = (): ChatFile[] =>
  store.messages.flatMap((m) => {
    const chat = store.chats.find((c) => c.id === m.chatId);
    if (!m.file || !chat?.memberIds.includes(currentMemberId)) return [];
    return [
      {
        messageId: m.id,
        chatId: chat.id,
        chatTitle: chat.title,
        name: m.file.name,
        ext: m.file.ext,
        authorId: m.authorId,
        at: m.at,
      },
    ];
  });

/** Сообщения из переписок, где пользователь участник, — для поиска по системе */
export const fetchMemberMessages = () =>
  store.messages.flatMap((message) => {
    const chat = store.chats.find((c) => c.id === message.chatId);
    if (!chat?.memberIds.includes(currentMemberId)) return [];
    const author = message.authorId ? (chatMembers[message.authorId]?.short ?? null) : null;
    return [structuredClone({ message, chatTitle: chat.title, author })];
  });

export function markChatRead(chatId: string) {
  const chat = find(chatId);
  const last = store.messages.filter((m) => m.chatId === chatId).at(-1);
  if (last && last.at > chat.readAt) chat.readAt = last.at;
}

export type OutgoingMessage = Pick<ChatMessage, 'text' | 'kind' | 'task' | 'file' | 'threadId'>;

/**
 * Отправить сообщение. В личной переписке с тем, кто в отпуске, приходит автоответ
 * с заместителем — как в макете.
 */
export function sendMessage(chatId: string, message: OutgoingMessage): ChatMessage {
  const chat = find(chatId);
  const at = new Date().toISOString();
  const sent: ChatMessage = {
    id: `m-new-${++seq}`,
    chatId,
    authorId: currentMemberId,
    at,
    ...message,
  };
  store.messages.push(sent);
  chat.readAt = at;

  if (chat.kind === 'direct' && chat.peerId) {
    const absence = absenceOf(chat.peerId);
    if (absence && isAbsentOn(absence, todayInBishkek())) {
      store.messages.push({
        id: `m-new-${++seq}`,
        chatId,
        authorId: null,
        at,
        kind: 'system',
        text: absence.deputy.short,
        system: { kind: 'autoreply', title: absence.to },
      });
      chat.readAt = at;
    }
  }
  return structuredClone(sent);
}

/** Личная переписка с сотрудником: открыть существующую или начать новую */
export function startDirect(peerId: string): string {
  const existing = store.chats.find((c) => c.kind === 'direct' && c.peerId === peerId);
  if (existing) return existing.id;
  const peer = chatMembers[peerId];
  if (!peer) throw new Error('member-not-found');
  const chat: Chat = {
    id: `c-${peerId}`,
    kind: 'direct',
    title: peer.name,
    fullTitle: peer.name,
    memberIds: [currentMemberId, peerId],
    peerId,
    readAt: new Date().toISOString(),
    muted: false,
  };
  store.chats.push(chat);
  return chat.id;
}

export function setMuted(chatId: string, muted: boolean) {
  find(chatId).muted = muted;
}

export const chatKey = ['chat'] as const;

export function useChats() {
  return useQuery({
    queryKey: [...chatKey, 'list'],
    queryFn: async () => {
      await delay(100);
      return fetchChats();
    },
  });
}

export function useMessages(chatId: string | null) {
  return useQuery({
    enabled: chatId !== null,
    queryKey: [...chatKey, 'messages', chatId],
    queryFn: async () => {
      await delay(80);
      return chatId ? fetchMessages(chatId) : [];
    },
  });
}

export function useChatFiles(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...chatKey, 'files'],
    queryFn: async () => {
      await delay(60);
      return fetchChatFiles();
    },
  });
}

export function useMemberMessages(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...chatKey, 'search'],
    queryFn: async () => fetchMemberMessages(),
  });
}

/** Сколько непрочитанных во всех чатах */
export function useChatUnread() {
  return useQuery({
    queryKey: [...chatKey, 'unread'],
    queryFn: async () => unreadTotal(),
  }).data;
}

function useChatMutation<V, R>(fn: (vars: V) => R) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => {
      await delay(60);
      return fn(vars);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: chatKey }),
  });
}

export const useMarkChatRead = () => useChatMutation((chatId: string) => markChatRead(chatId));

export const useSendMessage = () =>
  useChatMutation(({ chatId, message }: { chatId: string; message: OutgoingMessage }) =>
    sendMessage(chatId, message),
  );

export const useStartDirect = () => useChatMutation((peerId: string) => startDirect(peerId));

export const useSetMuted = () =>
  useChatMutation(({ chatId, muted }: { chatId: string; muted: boolean }) =>
    setMuted(chatId, muted),
  );

export { chatMembers, currentMemberId };
