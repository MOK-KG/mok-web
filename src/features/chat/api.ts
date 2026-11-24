import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCan } from '@/features/auth/permissions';
import { type ApiPerson, toPerson } from '@/features/tasks/api';
import { api } from '@/shared/api/client';
import type { RoleCode } from '@/shared/config/permissions';
import type { Chat, ChatMember, ChatMessage, ChatSummary } from './types';

/**
 * Данные чата — API бэкенда (mok-backend, apps/chat, /api/chat/*). Чат видят только его
 * участники; непрочитанные считает сервер. Новые сообщения — опросом: открытая переписка
 * раз в 5 секунд догружает только новое (`?after=<ID последнего>`), список — раз в 15 секунд.
 *
 * В тестах вместо бэкенда — подставной сервер testing/server.ts на данных mock.ts.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

// --- Формат бэкенда ---------------------------------------------------------------------------

export type ApiChatMember = ApiPerson & { role: RoleCode | ''; active: boolean };

export type ApiChatMessage = {
  id: string;
  chatId: string;
  authorId: string | null;
  at: string;
  kind: ChatMessage['kind'];
  text: string;
  threadId: string | null;
  task: NonNullable<ChatMessage['task']> | null;
  taskHidden?: boolean;
  article?: NonNullable<ChatMessage['article']> | null;
  system: NonNullable<ChatMessage['system']> | null;
  file: { name: string; ext: string; size: number } | null;
};

export type ApiChatSummary = Chat & { last: ApiChatMessage | null; unread: number };

export type ApiChatFile = Omit<ChatFile, 'size'> & { size: number };

export type ApiSearchHit = { message: ApiChatMessage; chatTitle: string; author: string | null };

// --- Преобразования ---------------------------------------------------------------------------

export const toChatMember = (m: ApiChatMember): ChatMember => {
  const p = toPerson(m);
  return {
    id: p.id,
    name: p.name,
    short: p.short,
    tone: p.tone,
    role: (m.role || 'R5') as RoleCode,
    department: m.department ?? '',
    active: m.active,
  };
};

export function toMessage(m: ApiChatMessage): ChatMessage {
  return {
    id: String(m.id),
    chatId: String(m.chatId),
    authorId: m.authorId === null ? null : String(m.authorId),
    at: m.at,
    kind: m.kind,
    text: m.text,
    ...(m.threadId ? { threadId: String(m.threadId) } : {}),
    ...(m.task ? { task: m.task } : {}),
    ...(m.taskHidden ? { taskHidden: true } : {}),
    ...(m.article ? { article: m.article } : {}),
    ...(m.system ? { system: m.system } : {}),
    ...(m.file ? { file: m.file } : {}),
  };
}

const toSummary = (c: ApiChatSummary): ChatSummary => ({
  ...c,
  id: String(c.id),
  memberIds: c.memberIds.map(String),
  peerId: c.peerId === null ? null : String(c.peerId),
  last: c.last ? toMessage(c.last) : null,
});

// --- Запросы ----------------------------------------------------------------------------------

/** Участники переписки (с ролью и департаментом) по ID */
export async function fetchChatMembers(): Promise<Record<string, ChatMember>> {
  const list = await api.get<ApiChatMember[]>('/chat/members');
  return Object.fromEntries(list.map((m) => [String(m.id), toChatMember(m)]));
}

/** Чаты пользователя: последнее сообщение ленты, непрочитанные; новые сверху */
export const fetchChats = async (): Promise<ChatSummary[]> =>
  (await api.get<ApiChatSummary[]>('/chat/chats')).map(toSummary);

/** Сообщения переписки по порядку; after — только новее сообщения с этим ID */
export async function fetchMessages(chatId: string, after?: string): Promise<ChatMessage[]> {
  const list = await api.get<ApiChatMessage[]>(`/chat/chats/${chatId}/messages`, {
    query: after ? { after } : undefined,
  });
  return list.map(toMessage);
}

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
export const unreadTotal = async () => (await api.get<{ total: number }>('/chat/unread')).total;

/** Файл из переписки — для раздела «Файлы» */
export type ChatFile = {
  messageId: string;
  chatId: string;
  chatTitle: string;
  name: string;
  ext: string;
  size?: number;
  authorId: string | null;
  at: string;
};

/** Файлы из переписок, где пользователь участник */
export const fetchChatFiles = async (): Promise<ChatFile[]> =>
  (await api.get<ApiChatFile[]>('/chat/files')).map((f) => ({
    ...f,
    messageId: String(f.messageId),
    chatId: String(f.chatId),
    authorId: f.authorId === null ? null : String(f.authorId),
  }));

/** Скачать файл сообщения */
export const chatFileUrl = (messageId: string) => api.url(`/chat/messages/${messageId}/file`);

/** Сообщения из переписок пользователя со словами запроса — для поиска по системе */
export async function fetchMemberMessages(query: string) {
  if (query.trim().length < 2) return [];
  const hits = await api.get<ApiSearchHit[]>('/chat/search', { query: { q: query } });
  return hits.map((h) => ({
    message: toMessage(h.message),
    chatTitle: h.chatTitle,
    author: h.author,
  }));
}

export async function markChatRead(chatId: string) {
  await api.post(`/chat/chats/${chatId}/read`);
}

export type OutgoingMessage = Pick<
  ChatMessage,
  'text' | 'kind' | 'task' | 'article' | 'threadId'
> & {
  /** Файл-вложение: уходит отдельным запросом multipart */
  upload?: File;
};

/**
 * Отправить сообщение. В личной переписке с тем, кто сегодня отсутствует, сервер следом
 * добавляет автоответ с заместителем — как в макете.
 */
export async function sendMessage(chatId: string, message: OutgoingMessage): Promise<ChatMessage> {
  if (message.upload) {
    const form = new FormData();
    form.append('file', message.upload);
    form.append('text', message.text);
    if (message.threadId) form.append('threadId', message.threadId);
    return toMessage(await api.post<ApiChatMessage>(`/chat/chats/${chatId}/files`, form));
  }
  return toMessage(
    await api.post<ApiChatMessage>(`/chat/chats/${chatId}/messages`, {
      kind: message.kind,
      text: message.text,
      threadId: message.threadId ?? null,
      ...(message.kind === 'task' ? { taskId: message.task?.id ?? null } : {}),
      ...(message.kind === 'article' ? { articleId: message.article?.id ?? null } : {}),
    }),
  );
}

/** Личная переписка с сотрудником: открыть существующую или начать новую */
export async function startDirect(peerId: string): Promise<string> {
  return String((await api.post<ApiChatSummary>('/chat/chats/direct', { peerId })).id);
}

export type GroupInput = { title: string; description: string; memberIds: string[] };

/** Новая группа: название, описание, участники (создатель — участник сам) */
export async function createGroup(input: GroupInput): Promise<string> {
  return String((await api.post<ApiChatSummary>('/chat/chats/groups', input)).id);
}

/** Название и описание группы меняет любой участник */
export async function updateGroup(
  chatId: string,
  patch: Partial<Pick<GroupInput, 'title' | 'description'>>,
) {
  await api.patch(`/chat/chats/${chatId}`, patch);
}

export async function addGroupMembers(chatId: string, memberIds: string[]) {
  await api.post(`/chat/chats/${chatId}/members`, { memberIds });
}

/** Убрать участника (создатель группы) или выйти самому (свой ID) */
export async function removeGroupMember(chatId: string, memberId: string) {
  await api.delete(`/chat/chats/${chatId}/members/${memberId}`);
}

export async function setMuted(chatId: string, muted: boolean) {
  await api.post(`/chat/chats/${chatId}/mute`, { muted });
}

// --- Хуки -------------------------------------------------------------------------------------

export const chatKey = ['chat'] as const;

const noMembers: Record<string, ChatMember> = {};

/** Справочник участников по ID; пока не загружен — пустой */
export function useChatMembers(enabled = true): Record<string, ChatMember> {
  return (
    useQuery({
      enabled,
      queryKey: [...chatKey, 'members'],
      queryFn: fetchChatMembers,
      staleTime: 5 * 60_000,
    }).data ?? noMembers
  );
}

export function useChats() {
  const { can } = useCan();
  return useQuery({
    enabled: can('chat.use'),
    queryKey: [...chatKey, 'list'],
    queryFn: fetchChats,
    refetchInterval: 15_000,
  });
}

/**
 * Сообщения открытой переписки. Сообщения только добавляются, поэтому повторный запрос
 * (опрос раз в 5 секунд или после отправки) догружает только новые и дописывает их в конец.
 */
export function useMessages(chatId: string | null) {
  const client = useQueryClient();
  const queryKey = [...chatKey, 'messages', chatId];
  return useQuery({
    enabled: chatId !== null,
    queryKey,
    queryFn: async () => {
      if (!chatId) return [];
      const known = client.getQueryData<ChatMessage[]>(queryKey) ?? [];
      const last = known.at(-1)?.id;
      if (!last) return fetchMessages(chatId);
      const fresh = await fetchMessages(chatId, last);
      if (fresh.length === 0) return known;
      const ids = new Set(known.map((m) => m.id));
      return [...known, ...fresh.filter((m) => !ids.has(m.id))];
    },
    refetchInterval: 5_000,
  });
}

export function useChatFiles(enabled = true) {
  return useQuery({ enabled, queryKey: [...chatKey, 'files'], queryFn: fetchChatFiles });
}

export function useMemberMessages(query: string, enabled = true) {
  return useQuery({
    enabled: enabled && query.trim().length > 1,
    queryKey: [...chatKey, 'search', query.trim()],
    queryFn: () => fetchMemberMessages(query),
  });
}

/** Сколько непрочитанных во всех чатах */
export function useChatUnread() {
  const { can } = useCan();
  return useQuery({
    enabled: can('chat.use'),
    queryKey: [...chatKey, 'unread'],
    queryFn: unreadTotal,
    refetchInterval: 30_000,
  }).data;
}

function useChatMutation<V, R>(fn: (vars: V) => Promise<R>, successMessage?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => client.invalidateQueries({ queryKey: chatKey }),
    ...(successMessage ? { meta: { successMessage } } : {}),
  });
}

export const useMarkChatRead = () => useChatMutation((chatId: string) => markChatRead(chatId));

export const useSendMessage = () =>
  useChatMutation(({ chatId, message }: { chatId: string; message: OutgoingMessage }) =>
    sendMessage(chatId, message),
  );

export const useStartDirect = () => useChatMutation((peerId: string) => startDirect(peerId));

export const useCreateGroup = () => useChatMutation(createGroup, 'chat.groupCreated');

export const useUpdateGroup = () =>
  useChatMutation(
    ({
      chatId,
      ...patch
    }: { chatId: string } & Partial<Pick<GroupInput, 'title' | 'description'>>) =>
      updateGroup(chatId, patch),
    'chat.groupSaved',
  );

export const useAddGroupMembers = () =>
  useChatMutation(
    ({ chatId, memberIds }: { chatId: string; memberIds: string[] }) =>
      addGroupMembers(chatId, memberIds),
    'chat.groupAdded',
  );

export const useRemoveGroupMember = () =>
  useChatMutation(({ chatId, memberId }: { chatId: string; memberId: string }) =>
    removeGroupMember(chatId, memberId),
  );

export const useSetMuted = () =>
  useChatMutation(({ chatId, muted }: { chatId: string; muted: boolean }) =>
    setMuted(chatId, muted),
  );
