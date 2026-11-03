import type { Person } from '@/features/tasks/types';
import type { IsoDate } from '@/shared/lib/workDays';
import type { Letter } from './letter';

/**
 * Делопроизводство: входящие, исходящие, приказы.
 *
 * Регистрационный номер — сквозной по виду документа и году, без пропусков (глоссарий).
 * Выдаётся при регистрации входящего и при отправке исходящего / подписании приказа;
 * у черновика номера нет. Документ не удаляется — аннулируется, номер остаётся занятым.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type DocKind = 'incoming' | 'outgoing' | 'order';

export const docKinds: DocKind[] = ['incoming', 'outgoing', 'order'];

/**
 * - draft — проект исходящего или приказа, без номера;
 * - registered — входящий зарегистрирован, ждёт резолюции;
 * - inWork — резолюция наложена, по ней создана задача;
 * - done — входящий исполнен и снят с контроля;
 * - sent — исходящий отправлен; signed — приказ подписан;
 * - annulled — аннулирован, номер занят.
 */
export type DocStatus = 'draft' | 'registered' | 'inWork' | 'done' | 'sent' | 'signed' | 'annulled';

/** Статусы, которые бывают у вида документа, — для фильтров */
export const statusesOf: Record<DocKind, DocStatus[]> = {
  incoming: ['registered', 'inWork', 'done', 'annulled'],
  outgoing: ['draft', 'sent', 'annulled'],
  order: ['draft', 'signed', 'annulled'],
};

/** Резолюция — указание руководителя на входящем; по ней создаётся задача */
export type Resolution = {
  text: string;
  author: Person;
  /** ISO-время */
  at: string;
  assignee: Person;
  due: IsoDate;
  /** Задача по резолюции — по названию, как в уведомлениях и чате (ID — с бэкендом) */
  taskTitle: string | null;
};

export type DocHistoryKind =
  | 'created'
  | 'edited'
  | 'registered'
  | 'resolution'
  | 'done'
  | 'sent'
  | 'signed'
  | 'annulled';

/** Журнал документа: только добавляется, записи не меняются и не удаляются */
export type DocHistoryEntry = {
  id: string;
  kind: DocHistoryKind;
  at: string;
  by: Person;
  text: string;
};

export type DocumentRecord = {
  id: string;
  kind: DocKind;
  status: DocStatus;
  /** Порядковый номер за год; null — черновик */
  seq: number | null;
  year: number;
  /** Дата регистрации, отправки или подписания; у черновика — дата создания */
  date: IsoDate;
  title: string;
  /** Корреспондент (от кого входящий, кому исходящий); у приказа — null */
  party: string | null;
  /** Исходящий номер отправителя у входящего: «№ 12-04/518» */
  senderRef: string | null;
  summary: string;
  attachments: string[];
  /** Кто зарегистрировал или подготовил */
  author: Person;
  /** Кто подписал исходящий или приказ */
  signer: Person | null;
  resolution: Resolution | null;
  annulment: { reason: string; by: Person; at: string } | null;
  history: DocHistoryEntry[];
  /** Текст исходящего письма на бланке; у входящих и приказов — null */
  letter: Letter | null;
  /** Отпечаток содержания при отправке; после него письмо не меняется */
  fingerprint: string | null;
};
