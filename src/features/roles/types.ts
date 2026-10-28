import type { RoleCode } from '@/shared/config/permissions';
import type { Tone } from '@/shared/config/tokens';
import type { IsoDate } from '@/shared/lib/workDays';

/**
 * Статус учётной записи:
 * - invited — приглашён, ещё не входил;
 * - active — работает (в отпуске — тоже active, отпуск берётся из графика отпусков);
 * - external — внешний участник (ревизионная комиссия, аудит);
 * - vacancy — должность вакантна, учётной записи нет;
 * - deactivated — уволен: вход закрыт, запись остаётся (удалять сотрудников нельзя).
 */
export type StaffStatus = 'invited' | 'active' | 'external' | 'vacancy' | 'deactivated';

/** Статус для показа: отпуск поверх active */
export type StaffBadge = StaffStatus | 'vacation';

export type StaffMember = {
  id: string;
  /** ID в справочнике людей (задачи, база знаний); null — у человека нет задач в системе */
  personId: string | null;
  /** Для вакансии — null */
  name: string | null;
  short: string | null;
  email: string | null;
  tone: Tone;
  role: RoleCode;
  department: string;
  position: string;
  status: StaffStatus;
  invitedAt: IsoDate | null;
  invitedBy: string | null;
  /** Первый вход, ISO со временем; null — ещё не входил */
  firstLoginAt: string | null;
  /** Открытых сессий (устройств) */
  sessions: number;
  deactivatedAt: IsoDate | null;
  deactivatedBy: string | null;
};

/** Что произойдёт (или произошло) при деактивации */
export type DeactivationPlan = {
  /** Активные задачи сотрудника */
  tasks: number;
  /** Из них с эскалацией */
  escalated: number;
  /** Кому уйдут задачи: директор департамента, иначе генеральный секретарь */
  reassignTo: { id: string; short: string; isDirector: boolean } | null;
};
