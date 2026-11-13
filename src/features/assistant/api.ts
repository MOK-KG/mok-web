import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ApiPerson, tasksKey, toPerson } from '@/features/tasks/api';
import type { Person } from '@/features/tasks/types';
import { api } from '@/shared/api/client';
import type { RoleCode } from '@/shared/config/permissions';
import type { IsoDate } from '@/shared/lib/workDays';

/**
 * Настройки ИИ и агента почты — API бэкенда (mok-backend, apps/assistant, /api/assistant/*),
 * право assistant.manage. Пароль ящика и ключ OpenAI не приходят никогда — только флаги,
 * заданы ли они в окружении сервера. В тестах — подставной сервер testing/server.ts.
 */

export type AssistantEnvironment = {
  /** Задан ли OPENAI_API_KEY */
  openaiKey: boolean;
  /** Задан ли MAIL_AGENT_PASSWORD */
  mailPassword: boolean;
  /** Модель, если в настройках пусто */
  defaultModel: string;
};

export type AssistantSettings = {
  enabled: boolean;
  model: string;
  instructions: string;
  imapHost: string;
  imapPort: number;
  imapSsl: boolean;
  imapUser: string;
  imapFolder: string;
  pollMinutes: number;
  knowledgeRoles: RoleCode[];
  maxLetters: number;
  updatedAt: string;
  updatedBy: ApiPerson | null;
  environment: AssistantEnvironment;
};

export type AssistantSettingsInput = Partial<
  Omit<AssistantSettings, 'updatedAt' | 'updatedBy' | 'environment'>
>;

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

export const fetchAssistantSettings = () => api.get<AssistantSettings>('/assistant/settings');

export const saveAssistantSettings = (input: AssistantSettingsInput) =>
  api.patch<AssistantSettings>('/assistant/settings', input);

export const fetchAgentRuns = (limit = 20) => api.get<AgentRun[]>(`/assistant/runs?limit=${limit}`);

export const runAgentNow = () => api.post<AgentRun>('/assistant/run', {});

export const toDryRunSuggestion = (s: ApiDryRunSuggestion): DryRunSuggestion => ({
  ...s,
  assignee: s.assignee ? toPerson(s.assignee) : null,
});

export const dryRunAgent = async (input: DryRunInput) =>
  toDryRunSuggestion(await api.post<ApiDryRunSuggestion>('/assistant/dry-run', input));

export const useAssistantSettings = () =>
  useQuery({ queryKey: settingsKey, queryFn: fetchAssistantSettings });

export const useAgentRuns = () => useQuery({ queryKey: runsKey, queryFn: () => fetchAgentRuns() });

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
