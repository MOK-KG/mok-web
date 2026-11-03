import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatIsoDate } from '@/shared/lib/date';
import { todayInBishkek } from '@/shared/lib/workDays';
import { docNumber } from './api';
import { correspondenceLog, type LogRow, type ReplyState, reconcile } from './correspondence';
import type { DocumentRecord } from './types';

/** Сколько строк показывать сразу; дальше — «Показать ещё» */
const PAGE = 50;

type Filter = 'all' | 'incoming' | 'outgoing' | 'waiting' | 'overdue' | 'bounced';
const filters: Filter[] = ['all', 'incoming', 'outgoing', 'waiting', 'overdue', 'bounced'];

const matches: Record<Filter, (r: LogRow) => boolean> = {
  all: () => true,
  incoming: (r) => r.doc.kind === 'incoming',
  outgoing: (r) => r.doc.kind === 'outgoing',
  waiting: (r) => ['waiting', 'soon', 'drafted'].includes(r.reply),
  overdue: (r) => r.reply === 'overdue',
  bounced: (r) => r.urgent,
};

const replyTone: Record<ReplyState, string> = {
  answered: 'bg-success-chip text-success',
  drafted: 'bg-info-chip text-info-text',
  overdue: 'bg-danger-chip text-danger',
  soon: 'bg-warning-chip text-warning-text',
  waiting: 'bg-chip text-chip-text',
  none: '',
};

/**
 * Журнал корреспонденции (S-08): входящие и исходящие одной лентой со связками «в ответ на»,
 * сроками ответа и доставкой. Недоставки — отдельной срочной строкой сверху (приёмка 11.13).
 * Вверху — сверка с почтой.
 */
export function CorrespondenceLog({
  docs,
  onOpen,
}: {
  docs: DocumentRecord[];
  onOpen: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const today = todayInBishkek();
  const rows = useMemo(() => correspondenceLog(docs, today), [docs, today]);
  const summary = useMemo(() => reconcile(docs, today), [docs, today]);
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const urgent = rows.filter((r) => r.urgent);
  const shown = rows.filter((r) => !r.urgent && matches[filter](r));
  const visible = shown.slice(0, limit);
  const date = (d: string) => formatIsoDate(d, 'd MMM', i18n.language).replace('.', '');

  const stat = (
    labelKey: string,
    value: number,
    tone: 'neutral' | 'danger' | 'warning' = 'neutral',
  ) => (
    <div className="rounded-11 border border-line bg-panel px-4 py-3">
      <p className="text-[11.5px] text-faint">{t(labelKey)}</p>
      <p
        className={`mt-1 text-[20px] font-semibold tracking-[-0.4px] ${
          value > 0 && tone === 'danger'
            ? 'text-danger'
            : value > 0 && tone === 'warning'
              ? 'text-warning-text'
              : 'text-text'
        }`}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <section
        aria-label={t('documents.log.reconcile')}
        className="grid grid-cols-2 gap-3 md:grid-cols-5"
      >
        {stat('documents.log.emailed', summary.emailed)}
        {stat('documents.log.delivered', summary.delivered)}
        {stat('documents.log.bounced', summary.bounced, 'danger')}
        {stat('documents.log.overdue', summary.overdue, 'danger')}
        {stat('documents.log.soon', summary.soon, 'warning')}
      </section>

      {urgent.length > 0 && (
        <section
          role="alert"
          aria-label={t('documents.log.urgentTitle')}
          className="overflow-hidden rounded-14 border border-danger-line bg-danger-chip"
        >
          <h2 className="px-4 pb-1 pt-3 text-[12.5px] font-semibold text-danger">
            {t('documents.log.urgentTitle')} · {urgent.length}
          </h2>
          <ul>
            {urgent.map((r) => (
              <li key={r.doc.id} className="border-t border-danger-line first:border-t-0">
                <button
                  type="button"
                  onClick={() => onOpen(r.doc.id)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-row-highlight"
                >
                  <span className="font-medium text-text">{docNumber(r.doc)}</span>
                  <span className="min-w-0 flex-1 truncate text-text">{r.doc.title}</span>
                  <span className="text-[12px] text-danger">
                    {r.doc.delivery?.email} — {r.doc.delivery?.error}
                  </span>
                  <span className="text-[12px] font-medium text-info">
                    {t('documents.log.fix')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <fieldset className="flex flex-wrap gap-[6px]">
        <legend className="sr-only">{t('documents.statusFilter')}</legend>
        {filters
          .filter((f) => f !== 'bounced')
          .map((f) => {
            const on = f === filter;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFilter(f);
                  setLimit(PAGE);
                }}
                className={`flex h-7 items-center gap-[6px] rounded-8 border px-[10px] text-[12px] ${
                  on
                    ? 'border-transparent bg-control-active font-semibold text-text'
                    : 'border-line text-sub hover:text-text'
                }`}
              >
                {t(`documents.log.filter.${f}`)}
                <span
                  className={`text-[10.5px] font-medium ${on ? 'text-brand-gold' : 'text-dim'}`}
                >
                  {rows.filter((r) => !r.urgent && matches[f](r)).length}
                </span>
              </button>
            );
          })}
      </fieldset>

      <section
        aria-label={t('documents.tab.log')}
        className="min-h-0 flex-1 overflow-auto rounded-14 border border-line bg-panel"
      >
        <table className="w-full table-fixed text-left text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-panel">
            <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[1px] text-dim">
              <th className="w-[80px] px-4 py-[10px] font-semibold">{t('documents.col.date')}</th>
              <th className="w-[150px] px-3 py-[10px] font-semibold">
                {t('documents.col.number')}
              </th>
              <th className="w-[170px] px-3 py-[10px] font-semibold">{t('documents.log.party')}</th>
              <th className="px-3 py-[10px] font-semibold">{t('documents.col.title')}</th>
              <th className="w-[190px] px-3 py-[10px] font-semibold">{t('documents.log.link')}</th>
              <th className="w-[170px] px-4 py-[10px] font-semibold">{t('documents.log.state')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.doc.id}
                tabIndex={0}
                onClick={() => onOpen(r.doc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpen(r.doc.id);
                }}
                className={`cursor-pointer border-b border-line last:border-b-0 hover:bg-row-highlight ${
                  r.doc.status === 'annulled' ? 'text-dim' : ''
                }`}
              >
                <td className="px-4 py-[10px] text-faint">{date(r.doc.date)}</td>
                <td className="px-3 py-[10px]">
                  <span
                    className={`font-medium ${r.doc.status === 'annulled' ? 'line-through' : 'text-text'}`}
                  >
                    {docNumber(r.doc)}
                  </span>
                </td>
                <td className="truncate px-3 py-[10px] text-sub">
                  <span aria-hidden className="mr-1 text-dim">
                    {r.doc.kind === 'incoming' ? '←' : '→'}
                  </span>
                  {r.doc.party}
                </td>
                <td className="truncate px-3 py-[10px] text-text">{r.doc.title}</td>
                <td className="truncate px-3 py-[10px] text-[11.5px] text-sub">
                  {r.linked.length > 0
                    ? `${t(r.doc.kind === 'incoming' ? 'documents.log.answeredBy' : 'documents.log.replyTo')} ${r.linked
                        .map((l) => docNumber(l) ?? t('documents.noNumber'))
                        .join(', ')}`
                    : '—'}
                </td>
                <td className="px-4 py-[10px]">
                  <State row={r} date={date} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length > visible.length && (
          <div className="flex items-center justify-center gap-3 border-t border-line py-3 text-[12px]">
            <span className="text-dim">
              {t('documents.shownOf', { shown: visible.length, total: shown.length })}
            </span>
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="font-medium text-info hover:underline"
            >
              {t('documents.showMore')}
            </button>
          </div>
        )}
      </section>
      <p className="px-1 text-[11px] text-dim">{t('documents.log.note')}</p>
    </div>
  );
}

function State({ row, date }: { row: LogRow; date: (d: string) => string }) {
  const { t } = useTranslation();
  const chip =
    'inline-flex h-5 items-center whitespace-nowrap rounded-[5px] px-[7px] text-[10.5px] font-medium';
  if (row.doc.kind === 'outgoing') {
    const d = row.doc.delivery;
    if (!d) return <span className="text-[11.5px] text-dim">{t('documents.log.notByEmail')}</span>;
    return (
      <span
        className={`${chip} ${d.status === 'delivered' ? 'bg-success-chip text-success' : 'bg-danger-chip text-danger'}`}
      >
        {t(`documents.log.delivery.${d.status}`)}
      </span>
    );
  }
  if (row.reply === 'none')
    return <span className="text-[11.5px] text-dim">{t('documents.log.noReply')}</span>;
  return (
    <span className={`${chip} ${replyTone[row.reply]}`}>
      {t(`documents.log.reply.${row.reply}`, {
        date: row.doc.replyDue ? date(row.doc.replyDue) : '',
      })}
    </span>
  );
}
