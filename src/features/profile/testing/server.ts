import { vi } from 'vitest';
import type { LoginSession } from '../sessions';

/**
 * Подставной бэкенд активных сессий (/api/auth/sessions*) — как apps/accounts/views.py:
 * текущая сессия первой, завершить её нельзя (409 current_session).
 */
export function createSessionsServer(now = Date.now()) {
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const sessions: LoginSession[] = [
    {
      id: '1',
      platform: 'web',
      device: 'Chrome · macOS',
      ip: '10.0.0.1',
      createdAt: iso(600),
      lastSeenAt: iso(0),
      current: true,
    },
    {
      id: '2',
      platform: 'ios',
      device: 'НОК КР · iPhone',
      ip: '203.0.113.7',
      createdAt: iso(3000),
      lastSeenAt: iso(240),
      current: false,
    },
    {
      id: '3',
      platform: 'web',
      device: 'Неизвестное устройство',
      ip: null,
      createdAt: iso(5000),
      lastSeenAt: iso(5000),
      current: false,
    },
  ];

  function handle(method: string, path: string): { status: number; body?: unknown } {
    if (path === '/auth/sessions' && method === 'GET') {
      return { status: 200, body: { sessions } };
    }
    if (path === '/auth/sessions' && method === 'DELETE') {
      sessions.splice(0, sessions.length, ...sessions.filter((s) => s.current));
      return { status: 204 };
    }
    const one = path.match(/^\/auth\/sessions\/([^/]+)$/);
    if (one && method === 'DELETE') {
      const i = sessions.findIndex((s) => s.id === one[1]);
      if (i < 0) return { status: 404, body: { code: 'session_not_found' } };
      if (sessions[i].current) return { status: 409, body: { code: 'current_session' } };
      sessions.splice(i, 1);
      return { status: 204 };
    }
    return { status: 404, body: { code: 'not_found' } };
  }

  return { handle, sessions };
}

export type SessionsServer = ReturnType<typeof createSessionsServer>;

export let sessionsServer: SessionsServer;

export function installSessionsServer() {
  sessionsServer = createSessionsServer();
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/auth/sessions')) return previous(input, init);
      const reply = sessionsServer.handle(init.method ?? 'GET', path);
      return new Response(reply.status === 204 ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return sessionsServer;
}
