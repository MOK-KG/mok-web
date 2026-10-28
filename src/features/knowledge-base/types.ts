import type { Person, TaskStatus } from '@/features/tasks/types';
import type { RoleCode } from '@/shared/config/permissions';
import type { IsoDate } from '@/shared/lib/workDays';

/**
 * Раздел базы знаний. Закрытый раздел виден в списке (название и число статей),
 * но его статьи не приходят с бэкенда, не ищутся и не считаются.
 */
export type KbSection = {
  id: string;
  name: string;
  /** Статей в разделе всего — для закрытого раздела тоже */
  count: number;
  accessible: boolean;
  /** Каким ролям раздел открыт; null — всем */
  roles: RoleCode[] | null;
};

/** Блок текста статьи */
export type KbBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; id: string; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'note'; title: string; text: string };

/** Вложение; size — байты, null — размер неизвестен (файл из демо-данных) */
export type KbAttachment = { id: string; name: string; ext: string; size: number | null };

export type KbRelatedTask = {
  /** ID задачи в разделе «Задачи»; null — задачи нет среди доступных */
  id: string | null;
  title: string;
  status: TaskStatus;
};

export type KbRelatedDocument = { number: string; title: string };

/** Версия статьи: строка истории и текст, каким он был, — старую версию можно открыть */
export type KbVersion = {
  number: number;
  date: IsoDate;
  author: Person;
  change: string;
  title: string;
  summary: string;
  body: KbBlock[];
};

/** «Проверено, актуально»: текст не менялся, но его проверили — версия не добавляется */
export type KbReview = { date: IsoDate; by: Person };

/** Статья в списке */
export type KbArticleSummary = {
  id: string;
  sectionId: string;
  title: string;
  summary: string;
  author: Person;
  updatedAt: IsoDate;
  /** Последняя проверка без правок; null — не проверяли */
  reviewed: KbReview | null;
  /** Связанных задач и документов — столько же, сколько в карточке статьи */
  tasksCount: number;
  documentsCount: number;
};

export type KbArticle = KbArticleSummary & {
  version: number;
  body: KbBlock[];
  attachments: KbAttachment[];
  relatedTasks: KbRelatedTask[];
  relatedDocuments: KbRelatedDocument[];
  versions: KbVersion[];
};

/** Совпадения в закрытых разделах: статьи не показываются, только число и раздел */
export type KbHiddenMatches = { sectionId: string; sectionName: string; count: number };

export type KbFreshness = 'fresh' | 'stale' | null;
