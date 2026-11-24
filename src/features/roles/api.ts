import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentPersonId } from '@/features/auth';
import { isMockEnabled, mockApi } from '@/features/auth/mock';
import { sessionQueryKey } from '@/features/auth/useSession';
import { tasksKey, toPerson } from '@/features/tasks/api';
import { ApiError, api } from '@/shared/api/client';
import type { Permission, RoleCode } from '@/shared/config/permissions';
import type { DeactivationPlan, StaffBadge, StaffMember } from './types';

/**
 * Сотрудники и роли — API бэкенда (mok-backend, apps/accounts, /api/staff/members).
 * Права и правила проверяет бэкенд: сотрудника нельзя удалить — только деактивировать; себя
 * деактивировать нельзя; не может не остаться никого, кто назначает роли (409 last_admin).
 * План увольнения (сколько задач и кому уйдут) считает бэкенд, он же передаёт задачи.
 *
 * В тестах — подставной сервер testing/server.ts на данных mock.ts.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

export const EMAIL_DOMAIN = '@olympic.kg';

/** Сотрудник с тем, что считается на лету: отпуск, заместитель, последствия увольнения */
export type StaffRow = StaffMember & {
  badge: StaffBadge;
  isMe: boolean;
  /** Заместитель на время отпуска (ближайшего или текущего) */
  deputy: string | null;
  plan: DeactivationPlan;
};

/** Формат бэкенда: короткое имя и цвет фронт считает сам */
export type ApiStaffMember = Omit<StaffMember, 'short' | 'tone'> & {
  /** Отсутствует сегодня — показывается «В отпуске» */
  absentNow: boolean;
  deputy: string | null;
  plan: DeactivationPlan;
};

export function toStaffRow(m: ApiStaffMember, meId: string | undefined): StaffRow {
  const person = toPerson({ id: m.id, email: m.email ?? '', name: m.name ?? '' });
  return {
    id: m.id,
    personId: m.personId,
    name: m.name,
    short: m.name ? person.short : null,
    email: m.email,
    tone: person.tone,
    role: m.role,
    department: m.department,
    position: m.position,
    status: m.status,
    invitedAt: m.invitedAt,
    invitedBy: m.invitedBy,
    firstLoginAt: m.firstLoginAt,
    sessions: m.sessions,
    deactivatedAt: m.deactivatedAt,
    deactivatedBy: m.deactivatedBy,
    badge: m.status === 'active' && m.absentNow ? 'vacation' : m.status,
    isMe: !!meId && m.personId === meId,
    deputy: m.deputy,
    plan: m.plan,
  };
}

export async function fetchStaff(meId?: string): Promise<StaffRow[]> {
  const { members } = await api.get<{ members: ApiStaffMember[] }>('/staff/members');
  return members.map((m) => toStaffRow(m, meId));
}

/** Сменить роль. Действует сразу: сессии сотрудника получают новые права при следующем запросе */
export async function changeRole(id: string, role: RoleCode) {
  return toStaffRow(await api.post<ApiStaffMember>(`/staff/members/${id}/role`, { role }), '');
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
export async function inviteStaff(data: Invitation) {
  return toStaffRow(
    await api.post<ApiStaffMember>('/staff/members', {
      name: data.name,
      email: data.email,
      position: data.position,
      department: data.department,
      role: data.role,
      vacancyId: data.vacancyId ?? null,
    }),
    '',
  );
}

/**
 * Увольнение: вход закрыт, все сессии прекращены, незакрытые задачи — директору департамента
 * (с записью в истории задачи), авторство прошлых действий остаётся. Запись не удаляется.
 */
export const deactivateStaff = (id: string) =>
  api.post<{ reassigned: number }>(`/staff/members/${id}/deactivate`);

export const reactivateStaff = (id: string) =>
  api.post<ApiStaffMember>(`/staff/members/${id}/reactivate`);

export const staffKey = ['staff'] as const;

export function useStaff() {
  const meId = useCurrentPersonId();
  return useQuery({
    queryKey: [...staffKey, meId],
    queryFn: () => fetchStaff(meId),
  });
}

export function useChangeRole() {
  const client = useQueryClient();
  const meId = useCurrentPersonId();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: RoleCode }) => {
      const member = await changeRole(id, role);
      // Своя роль в заглушке входа: сессия меняется сразу, как сделал бы бэкенд
      if (member.personId === meId && isMockEnabled()) mockApi.setRole(role);
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
  return useMutation({
    mutationFn: inviteStaff,
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
  return useMutation({
    mutationFn: deactivateStaff,
    meta: { successMessage: 'access.deactivated' },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: staffKey });
      await client.invalidateQueries({ queryKey: tasksKey });
    },
  });
}

export function useReactivate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: reactivateStaff,
    meta: { successMessage: 'access.reactivated' },
    onSuccess: () => client.invalidateQueries({ queryKey: staffKey }),
  });
}

export type StaffSession = {
  id: string;
  device: string;
  platform: 'web' | 'ios' | 'android';
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

export type RoleInfo = { code: RoleCode; name: string; permissions: Permission[] };

const notSupported = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 405);

export function useMemberSessions(memberId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...staffKey, 'sessions', memberId],
    enabled: enabled && memberId !== null,
    retry: false,
    queryFn: async (): Promise<StaffSession[] | null> => {
      try {
        return (await api.get<{ sessions: StaffSession[] }>(`/staff/members/${memberId}/sessions`))
          .sessions;
      } catch (error) {
        if (notSupported(error)) return null;
        throw error;
      }
    },
  });
}

export function useEndSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, sessionId }: { memberId: string; sessionId: string | null }) =>
      api.delete(
        sessionId
          ? `/staff/members/${memberId}/sessions/${sessionId}`
          : `/staff/members/${memberId}/sessions`,
      ),
    meta: { successMessage: 'access.sessionEnded' },
    onSuccess: () => client.invalidateQueries({ queryKey: staffKey }),
  });
}

export function useOwnSessions() {
  return useQuery({
    queryKey: [...staffKey, 'own-sessions'],
    retry: false,
    queryFn: async (): Promise<StaffSession[] | null> => {
      try {
        return (await api.get<{ sessions: StaffSession[] }>('/auth/sessions')).sessions;
      } catch (error) {
        if (notSupported(error)) return null;
        throw error;
      }
    },
  });
}

export function useEndOwnSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string | null) =>
      api.delete(sessionId ? `/auth/sessions/${sessionId}` : '/auth/sessions'),
    meta: { successMessage: 'access.sessionEnded' },
    onSuccess: () => client.invalidateQueries({ queryKey: staffKey }),
  });
}

export function useSaveRolePermissions() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (changes: { code: RoleCode; permissions: Permission[] }[]) => {
      for (const { code, permissions } of changes) {
        await api.patch<RoleInfo>(`/staff/roles/${code}`, { permissions });
      }
    },
    meta: { successMessage: 'access.matrixSaved' },
    onSettled: () => {
      client.invalidateQueries({ queryKey: staffKey });
      client.invalidateQueries({ queryKey: sessionQueryKey });
    },
  });
}

export function useRoleMatrix() {
  return useQuery({
    queryKey: [...staffKey, 'roles'],
    retry: false,
    queryFn: async (): Promise<RoleInfo[] | null> => {
      try {
        return (await api.get<{ roles: RoleInfo[] }>('/staff/roles')).roles;
      } catch (error) {
        if (notSupported(error)) return null;
        throw error;
      }
    },
  });
}
