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
  Mailbox,
} from '../api';
import type { BotAction, BotMessage } from '../bot';

/**
 * Подставной бэкенд ассистента для тестов: те же адреса и формат, что у mok-backend
 * (apps/assistant/views.py: /api/assistant/settings|runs|run|dry-run|mailboxes). Модели нет —
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
    pollMinutes: 5,
    knowledgeRoles: [],
    maxLetters: 20,
    confidenceMin: 60,
    botModel: '',
    botDailyLimit: 200,
    updatedAt: '2026-11-10T09:00:00Z',
    updatedBy: null,
    environment: {
      openaiKey: true,
      defaultModel: 'gpt-4.1-mini',
      scheduler: { lastRunAt: '2026-11-24T08:00:00Z', ok: true, lastError: '' },
    },
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
  let mailboxes: Mailbox[] = [
    {
      id: 1,
      email: 'info@olympic.kg',
      label: 'INBOX',
      enabled: true,
      syncedUntil: '2026-11-10T08:00:00Z',
      connectedAt: '2026-11-01T09:00:00Z',
      connectedBy: apiPerson(people.dt),
      checkedAt: '2026-11-10T08:00:00Z',
      lastError: '',
      needsReconnect: false,
    },
  ];
  /** Писем в очереди без предложения */
  let queue = 2;

  const fields: Record<string, (v: unknown) => boolean> = {
    pollMinutes: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 1440,
    maxLetters: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 100,
    confidenceMin: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100,
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

  // --- Ассистент в чате: отвечает сразу; «задач…» в вопросе — карточка новой задачи ---------
  const bot = {
    available: true,
    messages: [] as (BotMessage & { conversationId: number })[],
    conversations: [] as { id: number; title: string; updatedAt: string }[],
    nextId: 1,
  };
  let botCurrent: number | null = null;

  function botConversation(id?: number | null) {
    const found = id ? bot.conversations.find((c) => c.id === id) : undefined;
    if (found || id) return found ?? null;
    return bot.conversations.find((c) => c.id === botCurrent) ?? null;
  }

  function botMessage(conversationId: number, fields: Partial<BotMessage>) {
    const message: BotMessage & { conversationId: number } = {
      conversationId,
      id: bot.nextId++,
      role: 'assistant',
      text: '',
      status: 'done',
      error: '',
      action: null,
      sources: [],
      steps: [],
      at: new Date().toISOString(),
      ...fields,
    };
    bot.messages.push(message);
    return message;
  }

  function botSend(body: Body): Reply {
    const text = String(body.text ?? '').trim();
    if (!text) return error(400, 'validation', { text: 'required' });
    if (!bot.available) return error(409, 'openai_key_missing');
    let conversation = botConversation(body.conversationId as number | undefined);
    if (body.conversationId && !conversation) return error(404, 'not_found');
    if (!conversation) {
      conversation = { id: bot.nextId++, title: '', updatedAt: new Date().toISOString() };
      bot.conversations.unshift(conversation);
    }
    if (!conversation.title) conversation.title = text.slice(0, 80);
    botCurrent = conversation.id;
    const c = conversation.id;
    const question = botMessage(c, { role: 'user', text });
    conversation.updatedAt = question.at;
    if (/задач/i.test(text)) {
      const action: BotAction = {
        id: `a${bot.nextId}`,
        kind: 'create_task',
        status: 'pending',
        preview: {
          title: 'Подготовить ответ федерации',
          fields: [
            { key: 'assignee', value: 'Нурлан Бакиров' },
            { key: 'due', value: '27.11.2026 (пт)' },
          ],
          warnings: [],
        },
        result: {},
        error: '',
        decidedAt: null,
      };
      botMessage(c, { role: 'action', action });
      botMessage(c, { text: 'Подготовил карточку задачи — подтвердите её.' });
    } else {
      botMessage(c, {
        text: 'Ответ по статье [Зоны ответственности](/knowledge/zony-otvetstvennosti).',
        sources: [
          {
            kind: 'article',
            title: 'Зоны ответственности',
            url: '/knowledge/zony-otvetstvennosti',
          },
        ],
        steps: [{ name: 'search_knowledge', arguments: '{}' }],
      });
    }
    return { status: 201, body: question };
  }

  function botDecide(id: string, decision: string): Reply {
    const message = bot.messages.find((m) => m.action?.id === id);
    if (!message?.action) return error(404, 'not_found');
    if (message.action.status !== 'pending') return error(409, 'action_decided');
    message.action =
      decision === 'confirm'
        ? {
            ...message.action,
            status: 'done',
            result: { taskId: 't-bot', code: 'ЗД-2026-0099', title: message.action.preview.title },
          }
        : { ...message.action, status: 'cancelled' };
    return { status: 200, body: message.action };
  }

  function handle(method: string, path: string, query: URLSearchParams, body?: Body): Reply {
    if (path === '/assistant/bot' && method === 'GET') {
      const id = Number(query.get('conversation')) || null;
      const conversation = botConversation(id);
      if (id && !conversation) return error(404, 'not_found');
      return {
        status: 200,
        body: {
          available: bot.available,
          conversation,
          messages: bot.messages.filter((m) => m.conversationId === conversation?.id),
          notesUrl: bot.messages.length ? '/knowledge/assistant-notes' : null,
        },
      };
    }
    if (path === '/assistant/bot' && method === 'POST') return botSend(body ?? {});
    if (path === '/assistant/bot/conversations' && method === 'GET') {
      const used = new Set(bot.messages.map((m) => m.conversationId));
      return { status: 200, body: bot.conversations.filter((c) => used.has(c.id)) };
    }
    if (path === '/assistant/bot/conversations' && method === 'POST') {
      const conversation = { id: bot.nextId++, title: '', updatedAt: new Date().toISOString() };
      bot.conversations.unshift(conversation);
      botCurrent = conversation.id;
      return { status: 201, body: conversation };
    }
    const decision = path.match(/^\/assistant\/bot\/actions\/([^/]+)\/(confirm|cancel)$/);
    if (decision && method === 'POST') return botDecide(decision[1], decision[2]);
    if (path === '/assistant/settings' && method === 'GET') return { status: 200, body: settings };
    if (path === '/assistant/settings' && method === 'PATCH') return patch(body ?? {});
    if (path === '/assistant/runs' && method === 'GET') {
      return { status: 200, body: runs.slice(0, Number(query.get('limit') ?? 50)) };
    }
    if (path === '/assistant/run' && method === 'POST') return run();
    if (path === '/assistant/dry-run' && method === 'POST') return dryRun(body ?? {});
    if (path === '/assistant/mailboxes' && method === 'GET')
      return { status: 200, body: mailboxes };
    const mailbox = path.match(/^\/assistant\/mailboxes\/(\d+)$/);
    if (mailbox) {
      const found = mailboxes.find((m) => m.id === Number(mailbox[1]));
      if (!found) return error(404, 'not_found');
      if (method === 'PATCH') {
        const input = body ?? {};
        if ('label' in input) found.label = String(input.label).trim() || 'INBOX';
        if ('enabled' in input) found.enabled = Boolean(input.enabled);
        return { status: 200, body: found };
      }
      if (method === 'DELETE') {
        mailboxes = mailboxes.filter((m) => m !== found);
        return { status: 204 };
      }
    }
    return error(404, 'not_found');
  }

  return {
    handle,
    bot,
    settings,
    runs,
    get mailboxes() {
      return mailboxes;
    },
  };
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
      if (reply.status === 204) return new Response(null, { status: 204 });
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return assistantServer;
}
