import { vi } from 'vitest';
import { journalServer } from '@/features/journal/testing/server';
import { type Absence, mockAbsences, setAbsenceCache } from '@/features/tasks/absences';
import type { ApiPerson } from '@/features/tasks/api';
import { people } from '@/features/tasks/directory';
import type { Person } from '@/features/tasks/types';
import { diffDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { type AbsenceInput, type ApiAbsence, absenceProblems } from '../api';

/**
 * Подставной бэкенд отсутствий для тестов: те же адреса и формат, что у mok-backend
 * (apps/accounts/staff_views.py: /api/staff/absences, /api/staff/people), данные — заглушка
 * mockAbsences (Н. Бакиров, Д. Токтосунова, М. Эсенова; заместитель — К. Асанов).
 * Остальные запросы уходят дальше. Ставится перед каждым тестом в src/test/setup.ts.
 *
 * Кэш синхронных помощников (absenceOf, deputyFor) сразу наполняется данными сервера —
 * как будто экран уже загрузил отсутствия.
 */

type Reply = { status: number; body?: unknown };
type Body = Record<string, unknown>;

const SESSION_KEY = 'nok.mockSession';
const allPeople = Object.values(people) as Person[];

export const apiPerson = (p: Person): ApiPerson => ({
  id: p.id,
  email: `${p.id}@olympic.kg`,
  name: p.name,
  position: '',
  department: p.unit ?? '',
});

/** Текущий сотрудник — из сессии заглушки входа, без неё — Айбек Дуйшеев */
export function sessionPerson(): Person {
  const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SESSION_KEY);
  const id = raw ? (JSON.parse(raw) as { user: { id?: string } }).user.id : undefined;
  return allPeople.find((p) => p.id === id) ?? people.ad;
}

const error = (status: number, code: string, extra: Body = {}): Reply => ({
  status,
  body: { code, detail: code, ...extra },
});

export function createAbsencesServer({ today = todayInBishkek() }: { today?: IsoDate } = {}) {
  const absences: Absence[] = mockAbsences(today);
  let seq = 0;

  const toApi = (a: Absence): ApiAbsence => ({
    id: a.id,
    kind: a.kind,
    person: apiPerson(a.person),
    dateFrom: a.from,
    dateTo: a.to,
    deputy: apiPerson(a.deputy),
    note: a.note,
    status: a.status,
    createdBy: a.createdBy,
    cancellation: a.cancellation,
  });

  const active = () => absences.filter((a) => a.status === 'active');

  /** Заместитель на день — как deputies_on на бэкенде (по самому раннему отсутствию) */
  function deputyOn(personId: string | undefined, day: IsoDate = today): Person | null {
    const found = active()
      .filter((a) => a.person.id === personId)
      .filter((a) => diffDays(a.from, day) >= 0 && diffDays(day, a.to) >= 0)
      .sort((a, b) => a.from.localeCompare(b.from));
    return found[0]?.deputy ?? null;
  }

  function handle(method: string, path: string, query: URLSearchParams, b: Body): Reply {
    if (path === '/staff/people' && method === 'GET') {
      return { status: 200, body: { people: allPeople.map(apiPerson) } };
    }
    if (path === '/staff/absences' && method === 'GET') {
      const status = query.get('status');
      return {
        status: 200,
        body: absences.filter((a) => !status || a.status === status).map(toApi),
      };
    }
    const me = sessionPerson();
    if (path === '/staff/absences' && method === 'POST') {
      const person = allPeople.find((p) => p.id === b.personId) ?? me;
      const deputy = allPeople.find((p) => p.id === b.deputyId) ?? null;
      const input: AbsenceInput = {
        kind: b.kind as Absence['kind'],
        person,
        from: b.dateFrom as IsoDate,
        to: b.dateTo as IsoDate,
        deputy,
        note: String(b.note ?? ''),
      };
      const problems = absenceProblems(input, active(), today);
      if (problems.length > 0 || !deputy) {
        return error(400, 'absence_invalid', { problems: problems.map((p) => p.code) });
      }
      const absence: Absence = {
        ...input,
        id: `abs-new-${++seq}`,
        deputy,
        note: input.note.trim(),
        status: 'active',
        createdBy: me.short,
        cancellation: null,
      };
      absences.push(absence);
      journalServer?.record(
        'absenceCreated',
        `${person.short}: ${absence.from} – ${absence.to} · заместитель ${deputy.short}`,
      );
      return { status: 201, body: toApi(absence) };
    }
    const one = path.match(/^\/staff\/absences\/([^/]+)$/);
    if (one && method === 'PATCH') {
      const absence = absences.find((a) => a.id === one[1]);
      if (!absence) return error(404, 'not_found');
      if (absence.status === 'cancelled') return error(409, 'absence_cancelled');
      const deputy = allPeople.find((p) => p.id === b.deputyId) ?? null;
      const input: AbsenceInput = {
        kind: b.kind as Absence['kind'],
        person: absence.person,
        from: b.dateFrom as IsoDate,
        to: b.dateTo as IsoDate,
        deputy,
        note: String(b.note ?? ''),
      };
      const problems = absenceProblems(
        input,
        active().filter((a) => a.id !== absence.id),
        today,
      );
      if (problems.length > 0 || !deputy) {
        return error(400, 'absence_invalid', { problems: problems.map((p) => p.code) });
      }
      Object.assign(absence, { ...input, deputy, note: input.note.trim() });
      journalServer?.record(
        'absenceUpdated',
        `${absence.person.short}: ${absence.from} – ${absence.to}`,
      );
      return { status: 200, body: toApi(absence) };
    }
    const cancel = path.match(/^\/staff\/absences\/([^/]+)\/cancel$/);
    if (cancel && method === 'POST') {
      const absence = absences.find((a) => a.id === cancel[1]);
      if (!absence) return error(404, 'not_found');
      if (absence.status === 'cancelled') return error(409, 'absence_cancelled');
      const reason = String(b.reason ?? '').trim();
      if (reason.length < 5) return error(400, 'reason_required', { fields: { reason: '' } });
      absence.status = 'cancelled';
      absence.cancellation = { reason, by: me.short, at: new Date().toISOString() };
      journalServer?.record(
        'absenceCancelled',
        `${absence.person.short}: ${absence.from} – ${absence.to}`,
        { reason },
      );
      return { status: 200, body: toApi(absence) };
    }
    return error(404, 'not_found');
  }

  return { handle, absences, deputyOn };
}

export type AbsencesServer = ReturnType<typeof createAbsencesServer>;

/** Сервер, установленный перед текущим тестом (src/test/setup.ts) */
export let absencesServer: AbsencesServer | undefined;

const handled = (path: string) => path === '/staff/people' || path.startsWith('/staff/absences');

/** Подменить fetch: /api/staff/absences и /api/staff/people — подставной сервер */
export function installAbsencesServer(options?: { today?: IsoDate }) {
  const server = createAbsencesServer(options);
  absencesServer = server;
  setAbsenceCache(structuredClone(server.absences));
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!handled(path)) return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : {};
      const reply = server.handle(init.method ?? 'GET', path, url.searchParams, body);
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return server;
}
