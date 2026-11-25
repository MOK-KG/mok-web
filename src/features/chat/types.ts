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
  /** false — сотрудник уволен: его сообщения остаются, новую переписку не начать */
  active?: boolean;
  /** Был активен в платформе последние 2 минуты */
  online?: boolean;
};

/**
 * Сообщение:
 * - text — обычный текст (может быть с вложением-файлом);
 * - task — карточка задачи из доски;
 * - article — карточка статьи базы знаний;
 * - system — служебное: эскалация, автоответ.
 */
export type ChatMessage = {
  id: string;
  chatId: string;
  /** null — системное сообщение */
  authorId: string | null;
  at: string;
  kind: 'text' | 'task' | 'article' | 'system';
  text: string;
  /** Для task: задача из доски — её состояние сейчас (assignee — короткое имя) */
  task?: { id?: string; title: string; status: TaskStatus; assignee: string; due: string | null };
  /** Для task: задачи недоступны читающему — карточка без названия */
  taskHidden?: boolean;
  /** Для article: id и title — null, если статья закрыта для читающего */
  article?: { id: string | null; title: string | null };
  /**
   * Для system: escalation — title заголовок, text пояснение;
   * autoreply — title дата конца отпуска (IsoDate), text заместитель
   */
  system?: { kind: 'escalation' | 'autoreply'; title: string };
  /** Ответ в ветке (S-33): ID сообщения, к которому ветка; в общей ленте канала не показывается */
  threadId?: string;
  /** Файл-вложение; скачать — chatFileUrl(id сообщения) */
  file?: { name: string; ext: string; size?: number };
};

/** Канал департамента, личная переписка или группа */
export type Chat = {
  id: string;
  kind: 'channel' | 'direct' | 'group';
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
  /** Описание группы; у канала и личной переписки пусто */
  description?: string;
  /** Создатель группы: только он убирает других участников */
  createdById?: string | null;
  /** Когда создан чат (ISO) */
  createdAt?: string;
};

/** Чат для списка: последнее сообщение и непрочитанные */
export type ChatSummary = Chat & {
  last: ChatMessage | null;
  unread: number;
};
