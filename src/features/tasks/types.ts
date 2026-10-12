import type { Tone } from '@/shared/config/tokens';
import type { IsoDate } from '@/shared/lib/workDays';

export type TaskStatus = 'queue' | 'in_progress' | 'review' | 'done';

export const taskStatuses: TaskStatus[] = ['queue', 'in_progress', 'review', 'done'];

export type Person = {
  id: string;
  name: string;
  /** Короткое имя для карточек: «Н. Бакиров» */
  short: string;
  tone: Tone;
};

export type Project = {
  id: string;
  name: string;
  tone: Tone;
};

export type Task = {
  id: string;
  /** Номер задачи: ЗД-2026-0412 */
  code: string;
  title: string;
  status: TaskStatus;
  project: Project;
  /** Срок; null — без срока */
  due: IsoDate | null;
  assignee: Person | null;
  author: Person;
  priority: 'low' | 'normal' | 'high';
  subtasks: number;
  comments: number;
  attachments: number;
  /** Создана из письма в очереди из почты */
  fromEmail: boolean;
  /** Сколько раз переносили срок */
  reschedules: number;
  /** Эскалация: уведомление не открыто N часов */
  escalationHours: number | null;
  /** Исполнитель в отпуске — задачу ведёт заместитель */
  deputy: Person | null;
};

/** Вкладки доски */
export type TaskTab = 'mine' | 'department' | 'createdByMe' | 'completed';

export const taskTabs: TaskTab[] = ['mine', 'department', 'createdByMe', 'completed'];

/** Лимит задач «В работе» (WIP) */
export const WIP_LIMIT = 6;
