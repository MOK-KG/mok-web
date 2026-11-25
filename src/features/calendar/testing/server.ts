import { vi } from 'vitest';
import { apiPerson, sessionPerson } from '@/features/absences/testing/server';
import { people } from '@/features/tasks/directory';
import { addWorkingDays, todayInBishkek } from '@/shared/lib/workDays';
import type { CalendarConnection, CalendarEvent } from '../events';

/**
 * Подставной бэкенд календаря для тестов: те же адреса и формат, что у mok-backend
 * (apps/events/views.py: /api/calendar/events|google). Ставится в src/test/setup.ts.
 */

type Reply = { status: number; body?: unknown };

export function createCalendarServer() {
  const day = addWorkingDays(todayInBishkek(), 1);
  const events: CalendarEvent[] = [
    {
      id: 'e1',
      title: 'Встреча по аккредитации',
      description: '',
      location: 'Зал 2',
      date: day,
      startTime: '10:00',
      endTime: '11:00',
      allDay: false,
      createdBy: apiPerson(sessionPerson()),
      attendees: [apiPerson(people.nb)],
      task: null,
      googleLink: 'https://calendar.google.com/event?eid=e1',
      googleError: '',
      source: 'platform',
    },
    {
      id: 'google:g1',
      title: 'Созвон с ОКА',
      description: '',
      location: '',
      date: day,
      startTime: '15:00',
      endTime: '16:00',
      allDay: false,
      createdBy: apiPerson(sessionPerson()),
      attendees: [],
      task: null,
      googleLink: 'https://calendar.google.com/event?eid=g1',
      googleError: '',
      source: 'google',
    },
  ];
  const connection: CalendarConnection = {
    connected: false,
    email: null,
    connectedAt: null,
    needsReconnect: false,
    lastError: '',
  };

  const created: Record<string, unknown>[] = [];

  function handle(
    method: string,
    path: string,
    query: URLSearchParams,
    body?: Record<string, unknown>,
  ): Reply {
    if (path === '/calendar/events' && method === 'POST') {
      const input = body ?? {};
      const title = String(input.title ?? '').trim();
      if (title.length < 2) {
        return {
          status: 400,
          body: { code: 'event_title', detail: 'event_title', fields: { title: 'x' } },
        };
      }
      created.push(input);
      const event: CalendarEvent = {
        id: `e${events.length + 2}`,
        title,
        description: String(input.description ?? ''),
        location: String(input.location ?? ''),
        date: input.date as CalendarEvent['date'],
        startTime: (input.startTime as string | null) ?? null,
        endTime: (input.endTime as string | null) ?? null,
        allDay: !input.startTime,
        createdBy: apiPerson(sessionPerson()),
        attendees: [],
        task: null,
        googleLink: input.google ? 'https://calendar.google.com/event?eid=new' : '',
        googleError: '',
        source: 'platform',
      };
      events.push(event);
      return { status: 201, body: event };
    }
    if (path === '/calendar/events' && method === 'GET') {
      const from = query.get('from') ?? '';
      const to = query.get('to') ?? '9999';
      return { status: 200, body: events.filter((e) => e.date >= from && e.date <= to) };
    }
    const cancel = path.match(/^\/calendar\/events\/([^/]+)\/cancel$/);
    if (cancel && method === 'POST') {
      const index = events.findIndex((e) => e.id === cancel[1]);
      if (index < 0) return { status: 404, body: { code: 'not_found' } };
      const [removed] = events.splice(index, 1);
      return { status: 200, body: removed };
    }
    if (path === '/calendar/google' && method === 'GET') return { status: 200, body: connection };
    if (path === '/calendar/google' && method === 'DELETE') {
      Object.assign(connection, { connected: false, email: null, connectedAt: null });
      return { status: 204 };
    }
    return { status: 404, body: { code: 'not_found', detail: 'not_found' } };
  }

  return { handle, events, connection, day, created };
}

export type CalendarServer = ReturnType<typeof createCalendarServer>;

/** Сервер, установленный перед текущим тестом */
export let calendarServer: CalendarServer;

export function installCalendarServer() {
  calendarServer = createCalendarServer();
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/calendar/')) return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : undefined;
      const reply = calendarServer.handle(init.method ?? 'GET', path, url.searchParams, body);
      if (reply.status === 204) return new Response(null, { status: 204 });
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return calendarServer;
}
