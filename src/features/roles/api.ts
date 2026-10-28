import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { isMockEnabled, mockApi } from '@/features/auth/mock';
import { sessionQueryKey } from '@/features/auth/useSession';
import { absenceOf, isAbsentOn } from '@/features/tasks/absences';
import { activeTasksOf, addJournalEntry, reassignTasksOf, tasksKey } from '@/features/tasks/api';
import { people } from '@/features/tasks/directory';
import type { Person } from '@/features/tasks/types';
import { ApiError } from '@/shared/api/errors';
import type { RoleCode } from '@/shared/config/permissions';
import { todayInBishkek } from '@/shared/lib/workDays';
import { createMockStaff } from './mock';
import type { DeactivationPlan, StaffBadge, StaffMember } from './types';

/**
 * Сотрудники и роли. Пока бэкенда нет — заглушка в памяти (mock.ts); когда появится API,
 * меняются только функции, хуки и интерфейс остаются.
 *
 * Права проверяет бэкенд; здесь — те же правила, чтобы экран вёл себя как настоящий:
 * сотрудника нельзя удалить — только деактивировать; себя деактивировать нельзя.
 */
let store = createMockStaff();

const delay = (ms: number) =>
  new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : ms));

/** Сброс заглушки (для тестов) */
export function resetStaffMock() {
  store = createMockStaff();
}

export const EMAIL_DOMAIN = '@olympic.kg';

/** Сотрудник с тем, что считается на лету: отпуск, заместитель, последствия увольнения */
export type StaffRow = StaffMember & {
  badge: StaffBadge;
  isMe: boolean;
  /** Заместитель на время отпуска (ближайшего или текущего) */
  deputy: string | null;
  plan: DeactivationPlan;
};

/**
 * Кому уйдут задачи: директор департамента (R4), иначе генеральный секретарь (R3),
 * иначе руководство (R2), иначе администратор (R1)
 */
function successorOf(member: StaffMember) {
  const working = store.filter(
    (s) => s.id !== member.id && (s.status === 'active' || s.status === 'invited'),
  );
  const director = working.find((s) => s.role === 'R4' && s.department === member.department);
  const target =
    director ??
    (['R3', 'R2', 'R1'] as RoleCode[]).map((r) => working.find((s) => s.role === r)).find(Boolean);
  return target ? { member: target, isDirector: !!director } : null;
}

function planFor(member: StaffMember): DeactivationPlan {
  const tasks = member.personId ? activeTasksOf(member.personId) : { count: 0, escalated: 0 };
  const successor = successorOf(member);
  return {
    tasks: tasks.count,
    escalated: tasks.escalated,
    reassignTo: successor && {
      id: successor.member.id,
      short: successor.member.short ?? '',
      isDirector: successor.isDirector,
    },
  };
}

/** Строка сотрудника; роль текущего пользователя — из его сессии */
function toRow(member: StaffMember, me: { email: string; role: RoleCode } | null): StaffRow {
  const isMe = !!me && member.email === me.email;
  const today = todayInBishkek();
  const absence = member.personId ? absenceOf(member.personId, today) : null;
  const onVacation = member.status === 'active' && absence !== null && isAbsentOn(absence, today);
  return {
    ...member,
    role: isMe && me ? me.role : member.role,
    badge: onVacation ? 'vacation' : member.status,
    isMe,
    deputy: absence?.deputy.short ?? null,
    plan: planFor(member),
  };
}

export function fetchStaff(me: { email: string; role: RoleCode } | null): StaffRow[] {
  return store.map((m) => structuredClone(toRow(m, me)));
}

const find = (id: string) => {
  const member = store.find((s) => s.id === id);
  if (!member) throw new ApiError(404, 'Not found');
  return member;
};

/** Сменить роль. Действует сразу: открытые сессии сотрудника получают новые права */
export function changeRole(id: string, role: RoleCode, actor: string) {
  const member = find(id);
  if (member.status === 'deactivated') {
    throw new ApiError(409, 'Deactivated', { code: 'user_deactivated' });
  }
  const from = member.role;
  member.role = role;
  addJournalEntry({
    author: actor,
    action: 'roleChanged',
    details: `${member.name ?? member.position}: ${from} → ${role}`,
  });
  return structuredClone(member);
}

export type Invitation = {
  name: string;
  email: string;
  position: string;
  department: string;
  role: RoleCode;
  /** Приглашение на вакансию: строка вакансии заменяется сотрудником */
  vacancyId?: string;
};

/** Пригласить: учётная запись создаётся только приглашением на адрес @olympic.kg */
export function inviteStaff(data: Invitation, actor: string): StaffMember {
  const email = data.email.trim().toLowerCase();
  if (!email.endsWith(EMAIL_DOMAIN) || email.length <= EMAIL_DOMAIN.length) {
    throw new ApiError(400, 'Wrong domain', { code: 'email_domain' });
  }
  if (store.some((s) => s.email === email)) {
    throw new ApiError(409, 'Email exists', { code: 'email_exists' });
  }
  const name = data.name.trim().replace(/\s+/g, ' ');
  const [first = '', last = ''] = name.split(' ');
  const member: StaffMember = {
    id: `s-${crypto.randomUUID()}`,
    personId: null,
    name,
    short: last ? `${first[0]}. ${last}` : name,
    email,
    tone: 'blue',
    role: data.role,
    department: data.department.trim(),
    position: data.position.trim(),
    status: 'invited',
    invitedAt: todayInBishkek(),
    invitedBy: actor,
    firstLoginAt: null,
    sessions: 0,
    deactivatedAt: null,
    deactivatedBy: null,
  };
  const vacancy = data.vacancyId
    ? store.findIndex((s) => s.id === data.vacancyId && s.status === 'vacancy')
    : -1;
  if (vacancy >= 0) store[vacancy] = member;
  else store.push(member);
  addJournalEntry({ author: actor, action: 'userInvited', details: `${name} · ${email}` });
  return structuredClone(member);
}

/**
 * Увольнение: вход закрыт, все сессии прекращены, незакрытые задачи — директору департамента
 * (с записью в истории задачи), авторство прошлых действий остаётся. Запись не удаляется.
 */
export function deactivateStaff(id: string, actor: { id: string; short: string }) {
  const member = find(id);
  if (member.id === actor.id) throw new ApiError(409, 'Self', { code: 'deactivate_self' });
  if (member.status === 'vacancy' || member.status === 'deactivated') {
    throw new ApiError(409, 'Not active', { code: 'user_not_active' });
  }
  const successor = successorOf(member);
  let reassigned = 0;
  if (member.personId && successor) {
    const s = successor.member;
    const to: Person = (s.personId && Object.values(people).find((p) => p.id === s.personId)) || {
      id: s.id,
      name: s.name ?? '',
      short: s.short ?? '',
      tone: s.tone,
      unit: s.department,
    };
    reassigned = reassignTasksOf(member.personId, to);
  }
  member.status = 'deactivated';
  member.sessions = 0;
  member.deactivatedAt = todayInBishkek();
  member.deactivatedBy = actor.short;
  addJournalEntry({
    author: actor.short,
    action: 'userDeactivated',
    details: `${member.name} · ${reassigned}`,
  });
  return { reassigned };
}

export const staffKey = ['staff'] as const;

/** Текущий пользователь: почта, роль и ID строки сотрудника */
function useMe() {
  const user = useSession().data?.user;
  const role = user?.roles[0] as RoleCode | undefined;
  const me = user && role ? { email: user.email, role } : null;
  const row = me ? store.find((s) => s.email === me.email) : undefined;
  return { me, actor: { id: row?.id ?? '', short: row?.short ?? user?.name ?? '' } };
}

export function useStaff() {
  const { me } = useMe();
  return useQuery({
    queryKey: [...staffKey, me?.email, me?.role],
    queryFn: async () => {
      await delay(120);
      return fetchStaff(me);
    },
  });
}

export function useChangeRole() {
  const client = useQueryClient();
  const { me, actor } = useMe();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: RoleCode }) => {
      await delay(120);
      const member = changeRole(id, role, actor.short);
      // Своя роль: в заглушке сессия меняется сразу, как сделал бы бэкенд
      if (me && member.email === me.email && isMockEnabled()) mockApi.setRole(role);
      return member;
    },
    meta: {
      successMessage: (m: StaffMember) => ({
        key: 'access.roleChanged',
        params: { name: m.name ?? m.position, role: m.role },
      }),
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: sessionQueryKey });
      await client.invalidateQueries({ queryKey: staffKey });
    },
  });
}

export function useInvite() {
  const client = useQueryClient();
  const { actor } = useMe();
  return useMutation({
    mutationFn: async (data: Invitation) => {
      await delay(150);
      return inviteStaff(data, actor.short);
    },
    meta: {
      successMessage: (m: StaffMember) => ({
        key: 'access.invited',
        params: { email: m.email },
      }),
      // Ошибки адреса показывает поле формы
      errorMessage: false,
    },
    onSuccess: () => client.invalidateQueries({ queryKey: staffKey }),
  });
}

export function useDeactivate() {
  const client = useQueryClient();
  const { actor } = useMe();
  return useMutation({
    mutationFn: async (id: string) => {
      await delay(200);
      return deactivateStaff(id, actor);
    },
    meta: { successMessage: 'access.deactivated' },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: staffKey });
      await client.invalidateQueries({ queryKey: tasksKey });
    },
  });
}
