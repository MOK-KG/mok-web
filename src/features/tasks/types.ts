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
  /** Подразделение: «Медицинский отдел» */
  unit?: string;
};

export type Project = {
  id: string;
  name: string;
  tone: Tone;
};

/**
 * Колонка канбана. Колонки настраиваются (API /tasks/columns), но каждая относится к одному
 * из этапов TaskStatus: по этапу — цвет точки и правило «готово»
 */
export type Column = {
  id: string;
  name: string;
  stage: TaskStatus;
  position: number;
  /** Сколько задач может быть в колонке; null — без лимита */
  wipLimit: number | null;
  /** Незаархивированных задач в колонке — для счётчика лимита */
  count: number;
};

export type Task = {
  id: string;
  /** Номер задачи: ЗД-2026-0412 */
  code: string;
  title: string;
  /** Этап колонки, в которой задача */
  status: TaskStatus;
  columnId: string;
  /** Место в колонке: доска показывает задачи в этом порядке (перетаскиванием) */
  position: number;
  /** null — без проекта */
  project: Project | null;
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

export type TaskAttachment = { id: string; filename: string; size: number };

export type Subtask = { id: string; title: string; done: boolean; assignee: Person | null };

export type Comment = { id: string; author: Person; at: string; text: string };

export type HistoryKind =
  | 'escalation'
  | 'assignee'
  | 'due'
  | 'created'
  | 'status'
  | 'subtask'
  | 'comment'
  | 'letter';

/** Запись журнала изменений задачи — только добавляется, не меняется и не удаляется */
export type HistoryEntry = { id: string; kind: HistoryKind; text: string; at: string };

export type TaskLetter = {
  id: string;
  sender: string;
  address: string;
  subject: string;
  body: string;
  receivedAt: string;
  followUp: boolean;
  attachments: number;
};

export type Reschedule = { from: IsoDate; to: IsoDate; by: Person };

/** Полные данные задачи для карточки (модального окна) */
export type TaskDetail = Task & {
  description: string;
  /** Название статьи базы знаний */
  knowledgeLink: string | null;
  /** Адрес статьи базы знаний (/knowledge/:id) */
  knowledgeArticleId: string | null;
  attachmentItems: TaskAttachment[];
  /** В архиве (вкладка «Завершённые») */
  archived?: boolean;
  subtaskItems: Subtask[];
  commentItems: Comment[];
  history: HistoryEntry[];
  rescheduleLog: Reschedule[];
  letters: TaskLetter[];
  /** За сколько дней напомнить исполнителю и постановщику; null — без напоминания */
  reminderDays: number | null;
  /** Время эскалации (ISO) */
  escalatedAt: string | null;
  source:
    | { kind: 'email'; mailbox: string; at: string }
    | {
        /** Создана резолюцией на документе делопроизводства */
        kind: 'document';
        documentId: string;
        documentKind: string;
        number: string | null;
        title: string;
        party: string;
        resolution: string;
        author: Person;
        at: string;
      }
    | { kind: 'manual' };
  department: string;
};

/** Вкладки доски */
export type TaskTab = 'mine' | 'department' | 'createdByMe' | 'completed';

export const taskTabs: TaskTab[] = ['mine', 'department', 'createdByMe', 'completed'];

/** Лимит задач «В работе» (WIP) по умолчанию; настоящий — у колонки (Column.wipLimit) */
export const WIP_LIMIT = 6;
