import { vi } from 'vitest';
import { apiPerson, sessionPerson } from '@/features/absences/testing/server';
import { people, projects } from '@/features/tasks/directory';
import { roleCodes } from '@/shared/config/permissions';
import { addWorkingDays, todayInBishkek } from '@/shared/lib/workDays';
import type {
  AgentRun,
  ApiDryRunSuggestion,
  AssistantSettings,
  AssistantSettingsInput,
} from '../api';

/**
 * Подставной бэкенд ассистента для тестов: те же адреса и формат, что у mok-backend
 * (apps/assistant/views.py: /api/assistant/settings|runs|run|dry-run). Модели нет —
 * «проверка на письме» отвечает готовым предложением. Остальные запросы уходят дальше.
 * Ставится перед каждым тестом в src/test/setup.ts.
 */

type Reply = { status: number; body?: unknown };
type Body = Record<string, unknown>;

const error = (status: number, code: string, fields?: Record<string, string>): Reply => ({
  status,
  body: { code, detail: code, ...(fields ? { fields } : {}) },
});

export function createAssistantServer() {
  const settings: AssistantSettings = {
    enabled: true,
    model: '',
    instructions: 'Письма МОК — приоритет высокий.',
    imapHost: 'imap.olympic.kg',
    imapPort: 993,
    imapSsl: true,
    imapUser: 'info@olympic.kg',
    imapFolder: 'INBOX',
    pollMinutes: 5,
    knowledgeRoles: [],
    maxLetters: 20,
    updatedAt: '2026-11-10T09:00:00Z',
    updatedBy: null,
    environment: { openaiKey: true, mailPassword: true, defaultModel: 'gpt-4.1-mini' },
  };
  const runs: AgentRun[] = [
    {
      id: 1,
      trigger: 'schedule',
      startedAt: '2026-11-10T08:00:00Z',
      finishedAt: '2026-11-10T08:00:20Z',
      fetched: 3,
      analyzed: 2,
      failed: 1,
      error: 'Аккредитация: RateLimitError',
      startedBy: null,
    },
  ];
  /** Писем в очереди без предложения */
  let queue = 2;

  const fields: Record<string, (v: unknown) => boolean> = {
    pollMinutes: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 1440,
    maxLetters: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 100,
    imapPort: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 65535,
    knowledgeRoles: (v) =>
      Array.isArray(v) && v.every((r) => (roleCodes as readonly string[]).includes(r)),
  };

  function patch(body: Body): Reply {
    for (const [key, ok] of Object.entries(fields)) {
      if (key in body && !ok(body[key])) return error(400, 'invalid_value', { [key]: 'invalid' });
    }
    const input = body as AssistantSettingsInput;
    Object.assign(settings, input);
    if ('knowledgeRoles' in input) settings.knowledgeRoles = [...new Set(input.knowledgeRoles)];
    settings.updatedAt = new Date().toISOString();
    settings.updatedBy = apiPerson(sessionPerson());
    return { status: 200, body: settings };
  }

  function run(): Reply {
    if (!settings.enabled) return error(409, 'assistant_disabled');
    const analyzed = Math.min(queue, settings.maxLetters);
    queue -= analyzed;
    const now = new Date().toISOString();
    const entry: AgentRun = {
      id: runs.length + 1,
      trigger: 'manual',
      startedAt: now,
      finishedAt: now,
      fetched: 0,
      analyzed,
      failed: 0,
      error: '',
      startedBy: apiPerson(sessionPerson()),
    };
    runs.unshift(entry);
    return { status: 201, body: entry };
  }

  function dryRun(body: Body): Reply {
    if (!body.subject) return error(400, 'validation', { subject: 'required' });
    if (!settings.environment.openaiKey) return error(409, 'openai_key_missing');
    const suggestion: ApiDryRunSuggestion = {
      title: `Подготовить ответ: ${String(body.subject)}`,
      assignee: apiPerson(people.nb),
      due: addWorkingDays(todayInBishkek(), 5),
      project: { id: projects.accreditation.id, name: projects.accreditation.name },
      priority: 'normal',
      flags: { project: 'confirm' },
      reasoning:
        'Аккредитация — зона юридического отдела по статье «Зоны ответственности»; срок ответа — 5 рабочих дней.',
      sources: [{ slug: 'zony-otvetstvennosti', title: 'Зоны ответственности' }],
      toolCalls: [{ name: 'search_knowledge', arguments: '{"query":"аккредитация"}' }],
    };
    return { status: 200, body: suggestion };
  }

  function handle(method: string, path: string, query: URLSearchParams, body?: Body): Reply {
    if (path === '/assistant/settings' && method === 'GET') return { status: 200, body: settings };
    if (path === '/assistant/settings' && method === 'PATCH') return patch(body ?? {});
    if (path === '/assistant/runs' && method === 'GET') {
      return { status: 200, body: runs.slice(0, Number(query.get('limit') ?? 50)) };
    }
    if (path === '/assistant/run' && method === 'POST') return run();
    if (path === '/assistant/dry-run' && method === 'POST') return dryRun(body ?? {});
    return error(404, 'not_found');
  }

  return { handle, settings, runs };
}

export type AssistantServer = ReturnType<typeof createAssistantServer>;

/** Сервер, установленный перед текущим тестом (src/test/setup.ts) */
export let assistantServer: AssistantServer;

/** Подменить fetch: /api/assistant/* отвечает подставной сервер, остальное — прежний fetch */
export function installAssistantServer() {
  assistantServer = createAssistantServer();
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/assistant/')) return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      const reply = assistantServer.handle(init.method ?? 'GET', path, url.searchParams, body);
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return assistantServer;
}
