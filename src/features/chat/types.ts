import type { TaskStatus } from '@/features/tasks/types';
import type { RoleCode } from '@/shared/config/permissions';
import type { Tone } from '@/shared/config/tokens';

/** Участник переписки: человек из справочника с ролью и департаментом */
export type ChatMember = {
  id: string;
  name: string;
  short: string;
  tone: Tone;
  role: RoleCode;
  department: string;
};

/**
 * Сообщение:
 * - text — обычный текст (может быть с вложением-файлом);
 * - task — карточка задачи из доски;
 * - system — служебное: эскалация, автоответ.
 */
export type ChatMessage = {
  id: string;
  chatId: string;
  /** null — системное сообщение */
  authorId: string | null;
  at: string;
  kind: 'text' | 'task' | 'system';
  text: string;
  /** Для task: задача по названию (ID появится с бэкендом) */
  task?: { title: string; status: TaskStatus; assignee: string; due: string | null };
  /**
   * Для system: escalation — title заголовок, text пояснение;
   * autoreply — title дата конца отпуска (IsoDate), text заместитель
   */
  system?: { kind: 'escalation' | 'autoreply'; title: string };
  /** Файл: в заглушке хранится только имя */
  file?: { name: string; ext: string };
};

/** Канал департамента или личная переписка */
export type Chat = {
  id: string;
  kind: 'channel' | 'direct';
  /** Канал: «Административный»; личный — имя собеседника */
  title: string;
  /** Канал: «Административный департамент» */
  fullTitle: string;
  memberIds: string[];
  /** Собеседник в личной переписке */
  peerId: string | null;
  /** До какого времени прочитано (ISO) */
  readAt: string;
  /** Уведомления о новых сообщениях выключены */
  muted: boolean;
};

/** Чат для списка: последнее сообщение и непрочитанные */
export type ChatSummary = Chat & {
  last: ChatMessage | null;
  unread: number;
};
