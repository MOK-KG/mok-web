import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ApiPerson, tasksKey, toPerson } from '@/features/tasks/api';
import type { Person } from '@/features/tasks/types';
import { api } from '@/shared/api/client';
import type { RoleCode } from '@/shared/config/permissions';
import type { IsoDate } from '@/shared/lib/workDays';

/**
 * Настройки ИИ и агента почты — API бэкенда (mok-backend, apps/assistant, /api/assistant/*),
 * право assistant.manage. Ключ OpenAI не приходит никогда — только флаг, задан ли он в окружении
 * сервера. Ящики Gmail подключаются через Google OAuth (доступ только на чтение): токены хранит
 * бэкенд, сюда приходит только адрес и состояние. В тестах — подставной сервер testing/server.ts.
 */

export type SchedulerStatus = {
  lastRunAt: string | null;
  ok: boolean;
  lastError: string;
};

export type AssistantEnvironment = {
  /** Задан ли OPENAI_API_KEY */
  openaiKey: boolean;
  /** Модель, если в настройках пусто */
  defaultModel: string;
  scheduler: SchedulerStatus;
};

export type AssistantSettings = {
  enabled: boolean;
  model: string;
  instructions: string;
  pollMinutes: number;
  knowledgeRoles: RoleCode[];
  maxLetters: number;
  /** Ниже этого процента уверенности письмо разбирает человек */
  confidenceMin: number;
  /** Модель ассистента в чате; пусто — как у агента почты */
  botModel: string;
  /** Сколько сообщений ассистенту в день у одного сотрудника */
  botDailyLimit: number;
  updatedAt: string;
  updatedBy: ApiPerson | null;
  environment: AssistantEnvironment;
};

export type AssistantSettingsInput = Partial<
  Omit<AssistantSettings, 'updatedAt' | 'updatedBy' | 'environment'>
>;

/** Ящик Gmail, подключённый через Google OAuth (gmail.readonly) */
export type Mailbox = {
  id: number;
  email: string;
  /** Метка Gmail, из которой читаются письма (название или ID) */
  label: string;
  enabled: boolean;
  /** Письма до этого момента уже загружены */
  syncedUntil: string;
  connectedAt: string;
  connectedBy: ApiPerson | null;
  checkedAt: string | null;
  lastError: string;
  /** Google отозвал доступ — подключить заново */
  needsReconnect: boolean;
};

export type MailboxInput = Partial<Pick<Mailbox, 'label' | 'enabled'>>;

/** Чем закончилось подключение ящика: бэкенд возвращает на страницу с ?mailbox=… */
export type MailboxConnectResult =
  | { status: 'connected'; email: string }
  | { status: 'error'; reason: string; email?: string };

export type AgentRunTrigger = 'schedule' | 'manual' | 'command';

export type AgentRun = {
  id: number;
  trigger: AgentRunTrigger;
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  analyzed: number;
  failed: number;
  error: string;
  startedBy: ApiPerson | null;
};

export type SuggestionField = 'title' | 'assignee' | 'due' | 'project' | 'priority';

export type ApiDryRunSuggestion = {
  title: string;
  assignee: ApiPerson | null;
  due: IsoDate | null;
  project: { id: string; name: string } | null;
  priority: 'low' | 'normal' | 'high';
  flags: Partial<Record<SuggestionField, 'confirm' | 'missing'>>;
  reasoning: string;
  sources: { slug: string; title: string }[];
  toolCalls: { name: string; arguments: string }[];
};

export type DryRunSuggestion = Omit<ApiDryRunSuggestion, 'assignee'> & {
  assignee: Person | null;
};

export type DryRunInput = { subject: string; body: string };

export const assistantKey = ['assistant'] as const;
const settingsKey = [...assistantKey, 'settings'] as const;
const runsKey = [...assistantKey, 'runs'] as const;
const mailboxesKey = [...assistantKey, 'mailboxes'] as const;

export const fetchAssistantSettings = () => api.get<AssistantSettings>('/assistant/settings');

export const saveAssistantSettings = (input: AssistantSettingsInput) =>
  api.patch<AssistantSettings>('/assistant/settings', input);

export const fetchAgentRuns = (limit = 20) => api.get<AgentRun[]>(`/assistant/runs?limit=${limit}`);

export const runAgentNow = () => api.post<AgentRun>('/assistant/run', {});

export const fetchMailboxes = () => api.get<Mailbox[]>('/assistant/mailboxes');

export const updateMailbox = ({ id, ...input }: MailboxInput & { id: number }) =>
  api.patch<Mailbox>(`/assistant/mailboxes/${id}`, input);

export const disconnectMailbox = (id: number) => api.delete<void>(`/assistant/mailboxes/${id}`);

/**
 * Подключить (или переподключить) ящик: переход на бэкенд → согласие Google → обратно на
 * returnTo с ?mailbox=connected&email=… или ?mailbox=error&reason=…
 */
export const connectMailbox = (returnTo: string, email?: string) =>
  window.location.assign(
    api.url('/assistant/mailboxes/connect', { returnTo, ...(email ? { email } : {}) }),
  );

/** Разобрать ?mailbox=… после возврата из Google */
export function mailboxConnectResult(params: URLSearchParams): MailboxConnectResult | null {
  const status = params.get('mailbox');
  const email = params.get('email') ?? undefined;
  if (status === 'connected' && email) return { status, email };
  if (status === 'error') return { status, reason: params.get('reason') ?? 'google_error', email };
  return null;
}

export const toDryRunSuggestion = (s: ApiDryRunSuggestion): DryRunSuggestion => ({
  ...s,
  assignee: s.assignee ? toPerson(s.assignee) : null,
});

export const dryRunAgent = async (input: DryRunInput) =>
  toDryRunSuggestion(await api.post<ApiDryRunSuggestion>('/assistant/dry-run', input));

export const useAssistantSettings = () =>
  useQuery({ queryKey: settingsKey, queryFn: fetchAssistantSettings });

export const useAgentRuns = () => useQuery({ queryKey: runsKey, queryFn: () => fetchAgentRuns() });

export const useMailboxes = () => useQuery({ queryKey: mailboxesKey, queryFn: fetchMailboxes });

export function useUpdateMailbox() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateMailbox,
    meta: { successMessage: 'assistant.mailboxSaved' },
    onSuccess: (data) =>
      client.setQueryData<Mailbox[]>(mailboxesKey, (list) =>
        list?.map((m) => (m.id === data.id ? data : m)),
      ),
  });
}

export function useDisconnectMailbox() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: disconnectMailbox,
    meta: { successMessage: 'assistant.mailboxDisconnected' },
    onSuccess: (_data, id) =>
      client.setQueryData<Mailbox[]>(mailboxesKey, (list) => list?.filter((m) => m.id !== id)),
  });
}

export function useSaveAssistantSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveAssistantSettings,
    meta: { successMessage: 'assistant.saved' },
    onSuccess: (data) => client.setQueryData(settingsKey, data),
  });
}

export function useRunAgentNow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: runAgentNow,
    meta: {
      successMessage: (run: AgentRun) => ({
        key: 'assistant.runDone',
        params: { analyzed: run.analyzed, failed: run.failed },
      }),
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: runsKey });
      // Предложения появились в очереди писем «Задач»
      await client.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

/** Проверка на письме: ошибку показывает сам экран (рядом с формой) */
export const useDryRunAgent = () =>
  useMutation({ mutationFn: dryRunAgent, meta: { errorMessage: false } });
