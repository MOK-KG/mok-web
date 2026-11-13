import { vi } from 'vitest';
import { absencesServer, sessionPerson } from '@/features/absences/testing/server';
import { journalServer } from '@/features/journal/testing/server';
import { tasksServer } from '@/features/tasks/testing/server';
import type { Person } from '@/features/tasks/types';
import { mockRoleMatrix, type RoleCode, roleCodes } from '@/shared/config/permissions';
import { diffDays, todayInBishkek } from '@/shared/lib/workDays';
import type { ApiStaffMember } from '../api';
import { createMockStaff } from '../mock';
import type { DeactivationPlan, StaffMember } from '../types';

/**
 * Подставной бэкенд «Ролей и доступа» для тестов: те же адреса и формат, что у mok-backend
 * (apps/accounts/staff_views.py: /api/staff/members…), данные — заглушка mock.ts.
 * Задачи для плана увольнения и их передачу берёт у подставного сервера задач, отпуска —
 * у сервера отсутствий. Роль текущего сотрудника — из сессии заглушки входа.
 * Ставится перед каждым тестом в src/test/setup.ts.
 */

type Reply = { status: number; body?: unknown };
type Body = Record<string, unknown>;

const SESSION_KEY = 'nok.mockSession';
const EMAIL_DOMAIN = '@olympic.kg';

const error = (status: number, code: string, extra: Body = {}): Reply => ({
  status,
  body: { code, detail: code, ...extra },
});

function sessionRole(): RoleCode | null {
  const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  return (JSON.parse(raw) as { user: { roles: RoleCode[] } }).user.roles[0] ?? null;
}

const working = (s: StaffMember) => s.status === 'active' || s.status === 'invited';

export function createStaffServer() {
  const staff = createMockStaff();
  let seq = 0;
  const me = () => staff.find((s) => s.personId === sessionPerson().id);
  const roleOf = (s: StaffMember) => (s === me() && sessionRole()) || s.role;

  /** Как successor_of на бэкенде: директор департамента (R4), иначе генеральный секретарь (R3) */
  function successorOf(member: StaffMember) {
    const others = staff.filter((s) => s.id !== member.id && working(s));
    const director = others.find((s) => roleOf(s) === 'R4' && s.department === member.department);
    const target = director ?? others.find((s) => roleOf(s) === 'R3');
    return target ? { member: target, isDirector: !!director } : null;
  }

  const openTasks = (member: StaffMember) =>
    member.personId && member.status !== 'deactivated'
      ? (tasksServer?.tasks ?? []).filter(
          (t) => !t.archived && t.status !== 'done' && t.assignee?.id === member.personId,
        )
      : [];

  function plan(member: StaffMember): DeactivationPlan {
    const tasks = openTasks(member);
    const successor = successorOf(member);
    return {
      tasks: tasks.length,
      escalated: tasks.filter((t) => t.escalationHours !== null).length,
      reassignTo: successor && {
        id: successor.member.id,
        short: successor.member.short ?? '',
        isDirector: successor.isDirector,
      },
    };
  }

  function row(member: StaffMember): ApiStaffMember {
    const today = todayInBishkek();
    const absence = (absencesServer?.absences ?? [])
      .filter((a) => a.status === 'active' && a.person.id === member.personId)
      .filter((a) => diffDays(today, a.to) >= 0)
      .sort((a, b) => a.from.localeCompare(b.from))[0];
    const { short: _short, tone: _tone, ...rest } = member;
    return {
      ...rest,
      role: roleOf(member),
      absentNow: !!absence && diffDays(absence.from, today) >= 0,
      deputy: absence?.deputy.short ?? null,
      plan: plan(member),
    };
  }

  const canAssignRoles = (role: RoleCode) => mockRoleMatrix[role].includes('roles.assign');

  function handle(method: string, path: string, b: Body): Reply {
    const actor = me();
    if (path === '/staff/members' && method === 'GET') {
      return { status: 200, body: { members: staff.map(row) } };
    }
    if (path === '/staff/members' && method === 'POST') {
      const email = String(b.email ?? '')
        .trim()
        .toLowerCase();
      if (!email.endsWith(EMAIL_DOMAIN) || email.length <= EMAIL_DOMAIN.length) {
        return error(400, 'email_domain', { fields: { email: 'email_domain' } });
      }
      if (staff.some((s) => s.email === email)) {
        return error(409, 'email_exists', { fields: { email: 'email_exists' } });
      }
      const name = String(b.name ?? '')
        .trim()
        .replace(/\s+/g, ' ');
      const id = `s-new-${++seq}`;
      const member: StaffMember = {
        id,
        personId: id,
        name,
        short: name,
        email,
        tone: 'blue',
        role: b.role as RoleCode,
        department: String(b.department ?? '').trim(),
        position: String(b.position ?? '').trim(),
        status: 'invited',
        invitedAt: todayInBishkek(),
        invitedBy: actor?.short ?? null,
        firstLoginAt: null,
        sessions: 0,
        deactivatedAt: null,
        deactivatedBy: null,
      };
      const vacancy = staff.findIndex((s) => s.id === b.vacancyId && s.status === 'vacancy');
      if (vacancy >= 0) staff[vacancy] = member;
      else staff.push(member);
      journalServer?.record('userInvited', `${name} · ${email}`);
      return { status: 201, body: row(member) };
    }

    const match = path.match(/^\/staff\/members\/([^/]+)\/(role|deactivate)$/);
    const member = match && staff.find((s) => s.id === match[1]);
    if (!match || method !== 'POST') return error(404, 'not_found');
    if (!member || member.status === 'vacancy') return error(404, 'not_found');

    if (match[2] === 'role') {
      const role = b.role as RoleCode;
      if (!roleCodes.includes(role)) return error(400, 'role_unknown');
      if (member.status === 'deactivated') return error(409, 'user_deactivated');
      const before = roleOf(member);
      if (before === role) return { status: 200, body: row(member) };
      const othersAssign = staff.some(
        (s) => s !== member && s.status !== 'deactivated' && canAssignRoles(roleOf(s)),
      );
      if (!canAssignRoles(role) && !othersAssign) return error(409, 'last_admin');
      member.role = role;
      journalServer?.record(
        'roleChanged',
        `${member.name ?? member.position}: ${before} → ${role}`,
      );
      return { status: 200, body: row(member) };
    }

    if (member === actor) return error(409, 'deactivate_self');
    if (member.status === 'deactivated') return error(409, 'user_not_active');
    const successor = successorOf(member);
    let reassigned = 0;
    if (successor) {
      const s = successor.member;
      const to: Person = {
        id: s.personId ?? s.id,
        name: s.name ?? '',
        short: s.short ?? '',
        tone: s.tone,
        unit: s.department,
      };
      for (const task of openTasks(member)) {
        task.history.unshift({
          id: `h-staff-${++seq}`,
          kind: 'assignee',
          text: `${task.assignee?.short ?? '—'}|${to.short}|deactivated`,
          at: new Date().toISOString(),
        });
        task.assignee = to;
        reassigned++;
      }
    }
    member.status = 'deactivated';
    member.sessions = 0;
    member.deactivatedAt = todayInBishkek();
    member.deactivatedBy = actor?.short ?? null;
    journalServer?.record('userDeactivated', `${member.name} · ${reassigned}`);
    return { status: 200, body: { reassigned } };
  }

  return { handle, staff };
}

export type StaffServer = ReturnType<typeof createStaffServer>;

/** Сервер, установленный перед текущим тестом (src/test/setup.ts) */
export let staffServer: StaffServer;

/** Подменить fetch: /api/staff/members* — подставной сервер, остальное — прежний fetch */
export function installStaffServer() {
  staffServer = createStaffServer();
  const previous = globalThis.fetch;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      if (!path.startsWith('/staff/members')) return previous(input, init);
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : {};
      const reply = staffServer.handle(init.method ?? 'GET', path, body);
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return staffServer;
}
