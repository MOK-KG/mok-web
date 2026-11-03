import { addWorkingDays, diffDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import type { DocCategory, DocumentRecord } from './types';

/**
 * Журнал корреспонденции (S-08) и реестр входящих (S-05): связка входящих и исходящих,
 * сроки ответа, доставка по почте и сверка. Недоставка — отдельная срочная строка
 * (приёмка 11.13).
 *
 * Доставка в заглушке: письмо уходит, если домен адресата известен; неизвестный домен —
 * недоставка «домен не найден», как ответ почтового сервера. С бэкендом — настоящая почта
 * olympic.kg и её отчёты о доставке.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

/** Домены, на которые заглушка «доставляет» письма */
const knownDomains = [
  'olympic.org',
  'olympic.kg',
  'anocolympic.org',
  'ocasia.org',
  'gov.kg',
  'kumtor.kg',
  'gmail.com',
  'mail.ru',
  'yandex.ru',
];

const EMAIL_RE = /^[^@\s]+@([^@\s]+\.[a-z]{2,})$/i;

export const isEmail = (value: string) => EMAIL_RE.test(value.trim());

export type DeliveryResult = { status: 'delivered' | 'bounced'; error: string | null };

/** Ответ почтового сервера на отправку (заглушка) */
export function deliver(email: string): DeliveryResult {
  const m = EMAIL_RE.exec(email.trim());
  if (!m) return { status: 'bounced', error: '553 5.1.3: неверный адрес' };
  const domain = m[1].toLowerCase();
  const known = knownDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
  return known
    ? { status: 'delivered', error: null }
    : { status: 'bounced', error: `550 5.1.2: домен ${domain} не найден` };
}

/** Срок ответа по умолчанию — по категории, в рабочих днях от регистрации */
export const defaultReplyDays: Record<DocCategory, number | null> = {
  request: 10,
  invitation: 5,
  agreement: 10,
  info: null,
  other: null,
};

export const defaultReplyDue = (category: DocCategory, registered: IsoDate) => {
  const days = defaultReplyDays[category];
  return days === null ? null : addWorkingDays(registered, days);
};

/**
 * Ответ на входящий:
 * - answered — отправлен исходящий в ответ;
 * - drafted — ответ готовится (есть проект);
 * - overdue — срок прошёл, ответа нет;
 * - soon — срок сегодня или в ближайшие 2 дня;
 * - waiting — срок есть, ещё не скоро;
 * - none — ответ не требуется (нет срока, исполнен или аннулирован без ответа).
 */
export type ReplyState = 'answered' | 'drafted' | 'overdue' | 'soon' | 'waiting' | 'none';

export function repliesTo(incomingId: string, docs: DocumentRecord[]) {
  return docs.filter(
    (d) => d.kind === 'outgoing' && d.replyTo === incomingId && d.status !== 'annulled',
  );
}

export function replyState(
  doc: DocumentRecord,
  docs: DocumentRecord[],
  today: IsoDate = todayInBishkek(),
): ReplyState {
  if (doc.kind !== 'incoming') return 'none';
  const replies = repliesTo(doc.id, docs);
  if (replies.some((r) => r.status === 'sent')) return 'answered';
  if (replies.length > 0) return 'drafted';
  if (!doc.replyDue || doc.status === 'annulled' || doc.status === 'done') return 'none';
  const left = diffDays(today, doc.replyDue);
  if (left < 0) return 'overdue';
  return left <= 2 ? 'soon' : 'waiting';
}

export type LogRow = {
  doc: DocumentRecord;
  /** Связанные: у входящего — ответы, у исходящего — на что отвечает */
  linked: DocumentRecord[];
  reply: ReplyState;
  /** Недоставка — строка сверху, срочная */
  urgent: boolean;
};

/**
 * Строки журнала: зарегистрированные входящие и отправленные исходящие (с номером),
 * новые сверху; недоставленные — отдельно и первыми.
 */
export function correspondenceLog(
  docs: DocumentRecord[],
  today: IsoDate = todayInBishkek(),
): LogRow[] {
  const byId = new Map(docs.map((d) => [d.id, d]));
  return docs
    .filter((d) => d.kind !== 'order' && d.seq !== null)
    .map((doc) => {
      const linked =
        doc.kind === 'incoming'
          ? repliesTo(doc.id, docs)
          : doc.replyTo && byId.get(doc.replyTo)
            ? [byId.get(doc.replyTo) as DocumentRecord]
            : [];
      return {
        doc,
        linked,
        reply: replyState(doc, docs, today),
        urgent: doc.delivery?.status === 'bounced' && doc.status !== 'annulled',
      };
    })
    .sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        b.doc.date.localeCompare(a.doc.date) ||
        (b.doc.seq ?? 0) - (a.doc.seq ?? 0),
    );
}

export type Reconciliation = {
  /** Отправлено по почте */
  emailed: number;
  delivered: number;
  bounced: number;
  /** Входящих, на которые пора ответить: просрочено и горит */
  overdue: number;
  soon: number;
};

/** Сверка с почтой: сколько ушло, дошло, не дошло; сколько ответов просрочено */
export function reconcile(
  docs: DocumentRecord[],
  today: IsoDate = todayInBishkek(),
): Reconciliation {
  const emailed = docs.filter(
    (d) => d.kind === 'outgoing' && d.delivery && d.status !== 'annulled',
  );
  const states = docs.map((d) => replyState(d, docs, today));
  return {
    emailed: emailed.length,
    delivered: emailed.filter((d) => d.delivery?.status === 'delivered').length,
    bounced: emailed.filter((d) => d.delivery?.status === 'bounced').length,
    overdue: states.filter((s) => s === 'overdue').length,
    soon: states.filter((s) => s === 'soon').length,
  };
}
