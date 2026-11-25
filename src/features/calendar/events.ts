import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiPerson } from '@/features/tasks/api';
import { api } from '@/shared/api/client';
import type { IsoDate } from '@/shared/lib/workDays';

/**
 * События календаря и личный Google Календарь — API бэкенда (mok-backend, apps/events,
 * /api/calendar/*), право calendar.view. Событие видят создатель и участники; если у создателя
 * подключён Google Календарь, событие уходит туда с приглашениями участникам, а события из его
 * Google Календаря приходят сюда же (source=google, только чтение).
 * В тестах — подставной сервер testing/server.ts.
 */

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  date: IsoDate;
  /** HH:MM по Бишкеку; null — весь день */
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  createdBy: ApiPerson;
  attendees: ApiPerson[];
  task: { id: string; code: string; title: string } | null;
  googleLink: string;
  googleError: string;
  /** platform — создано в платформе; google — из Google Календаря (только чтение) */
  source: 'platform' | 'google';
};

export type CalendarConnection = {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  needsReconnect: boolean;
  lastError: string;
};

/** Чем закончилось подключение: бэкенд возвращает с ?calendar=connected|error&reason=… */
export type CalendarConnectResult = { status: 'connected' } | { status: 'error'; reason: string };

export const calendarKey = ['calendar'] as const;
const connectionKey = [...calendarKey, 'google'] as const;

export const fetchEvents = (from: IsoDate, to: IsoDate) =>
  api.get<CalendarEvent[]>(`/calendar/events?from=${from}&to=${to}`);
export type EventInput = {
  title: string;
  date: IsoDate;
  startTime: string | null;
  endTime: string | null;
  description: string;
  location: string;
  attendeeIds: string[];
  /** Отправить в Google Календарь (если подключён) — участникам придут приглашения */
  google: boolean;
};

export const createEvent = (input: EventInput) =>
  api.post<CalendarEvent>('/calendar/events', input);
export const cancelEvent = (id: string) =>
  api.post<CalendarEvent>(`/calendar/events/${id}/cancel`, {});
export const fetchCalendarConnection = () => api.get<CalendarConnection>('/calendar/google');
export const disconnectCalendar = () => api.delete<void>('/calendar/google');

/** Подключить свой Google Календарь: переход на бэкенд → согласие Google → обратно */
export const connectCalendar = (returnTo: string) =>
  window.location.assign(api.url('/calendar/google/connect', { returnTo }));

export function calendarConnectResult(params: URLSearchParams): CalendarConnectResult | null {
  const status = params.get('calendar');
  if (status === 'connected') return { status };
  if (status === 'error') return { status, reason: params.get('reason') ?? 'google_error' };
  return null;
}

/** События по дням периода */
export function eventsOn(events: CalendarEvent[] | undefined): Map<IsoDate, CalendarEvent[]> {
  const byDay = new Map<IsoDate, CalendarEvent[]>();
  for (const e of events ?? []) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  return byDay;
}

export const useEvents = (from: IsoDate, to: IsoDate, enabled = true) =>
  useQuery({
    queryKey: [...calendarKey, 'events', from, to],
    queryFn: () => fetchEvents(from, to),
    enabled,
  });

export const useCalendarConnection = () =>
  useQuery({ queryKey: connectionKey, queryFn: fetchCalendarConnection });

export function useDisconnectCalendar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: disconnectCalendar,
    meta: { successMessage: 'profile.calendar.disconnected' },
    onSuccess: () => client.invalidateQueries({ queryKey: connectionKey }),
  });
}

export function useCreateEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createEvent,
    // Ошибки полей показывает форма
    meta: { successMessage: 'calendar.eventCreated', errorMessage: false },
    onSuccess: () => client.invalidateQueries({ queryKey: [...calendarKey, 'events'] }),
  });
}

export function useCancelEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: cancelEvent,
    meta: { successMessage: 'calendar.eventCancelled' },
    onSuccess: () => client.invalidateQueries({ queryKey: [...calendarKey, 'events'] }),
  });
}
