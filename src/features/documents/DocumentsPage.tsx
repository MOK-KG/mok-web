import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { useCan } from '@/features/auth';
import { formatIsoDate } from '@/shared/lib/date';
import { PlusIcon, SearchIcon } from '@/shared/ui/icons';
import { docNumber, useDocuments } from './api';
import { CorrespondenceLog } from './CorrespondenceLog';
import { DocumentPanel } from './DocumentPanel';
import { NewDocumentDialog } from './forms';
import { primaryButton, StatusChip } from './parts';
import { type DocKind, type DocStatus, docKinds, statusesOf } from './types';

/** Сколько строк показывать сразу; дальше — «Показать ещё» */
const PAGE = 50;

const isKind = (v: string | null): v is DocKind => docKinds.includes(v as DocKind);

/**
 * Делопроизводство: входящие, исходящие, приказы. Вид, статус и открытый документ — в адресе
 * (?kind=outgoing&status=draft&doc=ID). Удаления нет — только аннулирование. Макета нет.
 */
export function DocumentsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useCan();
  const [params, setParams] = useSearchParams();
  const kind: DocKind = isKind(params.get('kind')) ? (params.get('kind') as DocKind) : 'incoming';
  // Журнал корреспонденции (S-08) — четвёртая вкладка
  const isLog = params.get('kind') === 'log';
  const statusParam = params.get('status') as DocStatus | null;
  const status = statusParam && statusesOf[kind].includes(statusParam) ? statusParam : null;
  const openId = params.get('doc');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [creating, setCreating] = useState<DocKind | null>(null);
  const documents = useDocuments();
  const all = documents.data ?? [];

  const ofKind = useMemo(() => all.filter((d) => d.kind === kind), [all, kind]);
  const bounced = all.filter(
    (d) => d.delivery?.status === 'bounced' && d.status !== 'annulled',
  ).length;
  const needle = query.trim().toLocaleLowerCase('ru');
  const shown = useMemo(
    () =>
      ofKind.filter(
        (d) =>
          (!status || d.status === status) &&
          (!needle ||
            [docNumber(d), d.title, d.party, d.senderRef, d.summary].some((v) =>
              v?.toLocaleLowerCase('ru').includes(needle),
            )),
      ),
    [ofKind, status, needle],
  );
  const visible = shown.slice(0, limit);
  // Поиск в журнале — по тем же полям, что и во вкладках
  const logDocs = all.filter((d) =>
    [docNumber(d), d.title, d.party, d.senderRef, d.summary].some((v) =>
      v?.toLocaleLowerCase('ru').includes(needle),
    ),
  );
  const waiting = all.filter((d) => d.kind === 'incoming' && d.status === 'registered').length;

  usePageSubtitle(
    waiting > 0 ? t('documents.waitingSubtitle', { count: waiting }) : t('documents.subtitle'),
  );

  const setParam = (changes: Record<string, string | null>) => {
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(changes)) {
          if (v) p.set(k, v);
          else p.delete(k);
        }
        return p;
      },
      { replace: true },
    );
    setLimit(PAGE);
  };

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-3 leading-[normal]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t('sections.documents')} className="flex h-10 gap-6 px-1">
          {docKinds.map((k) => {
            const selected = !isLog && k === kind;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setParam({ kind: k === 'incoming' ? null : k, status: null })}
                className={`relative flex items-center gap-[7px] px-[3px] text-[13px] ${
                  selected ? 'font-semibold text-text' : 'text-sub hover:text-text'
                }`}
              >
                {t(`documents.tab.${k}`)}
                <span
                  className={`text-[11px] font-medium ${selected ? 'text-brand-gold' : 'text-dim'}`}
                >
                  {all.filter((d) => d.kind === k).length}
                </span>
                {selected && (
                  <span
                    aria-hidden
                    className="absolute inset-x-[3px] bottom-[4px] h-[2px] rounded-[1px] bg-brand-red"
                  />
                )}
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={isLog}
            onClick={() => setParam({ kind: 'log', status: null })}
            className={`relative flex items-center gap-[7px] px-[3px] text-[13px] ${
              isLog ? 'font-semibold text-text' : 'text-sub hover:text-text'
            }`}
          >
            {t('documents.tab.log')}
            {bounced > 0 && (
              <span className="rounded-[5px] bg-danger-chip px-[5px] text-[10.5px] font-semibold text-danger">
                {bounced}
              </span>
            )}
            {isLog && (
              <span
                aria-hidden
                className="absolute inset-x-[3px] bottom-[4px] h-[2px] rounded-[1px] bg-brand-red"
              />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-9 w-[260px] items-center gap-2 rounded-9 border border-line bg-control px-3 text-[12.5px] focus-within:border-info">
            <SearchIcon size={15} className="shrink-0 text-faint" />
            <span className="sr-only">{t('documents.search')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
              placeholder={t('documents.search')}
              className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-dim"
            />
          </label>
          {!isLog && can(kind === 'incoming' ? 'documents.register' : 'documents.create') && (
            <button type="button" className={primaryButton} onClick={() => setCreating(kind)}>
              <PlusIcon size={15} />
              {t(`documents.new.${kind}`)}
            </button>
          )}
        </div>
      </div>

      {isLog ? (
        <CorrespondenceLog docs={needle ? logDocs : all} onOpen={(id) => setParam({ doc: id })} />
      ) : (
        <>
          <fieldset className="flex flex-wrap gap-[6px]">
            <legend className="sr-only">{t('documents.statusFilter')}</legend>
            {[null, ...statusesOf[kind]].map((s) => {
              const on = s === status;
              return (
                <button
                  key={s ?? 'all'}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setParam({ status: s })}
                  className={`flex h-7 items-center gap-[6px] rounded-8 border px-[10px] text-[12px] ${
                    on
                      ? 'border-transparent bg-control-active font-semibold text-text'
                      : 'border-line text-sub hover:text-text'
                  }`}
                >
                  {s ? t(`documents.status.${s}`) : t('documents.all')}
                  <span
                    className={`text-[10.5px] font-medium ${on ? 'text-brand-gold' : 'text-dim'}`}
                  >
                    {s ? ofKind.filter((d) => d.status === s).length : ofKind.length}
                  </span>
                </button>
              );
            })}
          </fieldset>

          <section
            aria-label={t(`documents.tab.${kind}`)}
            className="min-h-0 flex-1 overflow-auto rounded-14 border border-line bg-panel"
          >
            {documents.isPending ? (
              <p className="px-6 py-12 text-center text-[12.5px] text-dim">
                {t('documents.loading')}
              </p>
            ) : shown.length === 0 ? (
              <p className="px-6 py-12 text-center text-[12.5px] text-dim">
                {needle || status ? t('documents.nothingFound') : t('documents.empty')}
              </p>
            ) : (
              <table className="w-full table-fixed text-left text-[12.5px]">
                <thead className="sticky top-0 z-10 bg-panel">
                  <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[1px] text-dim">
                    <th className="w-[150px] px-4 py-[10px] font-semibold">
                      {t('documents.col.number')}
                    </th>
                    <th className="w-[110px] px-3 py-[10px] font-semibold">
                      {t('documents.col.date')}
                    </th>
                    {kind !== 'order' && (
                      <th className="w-[190px] px-3 py-[10px] font-semibold">
                        {t(`documents.col.party.${kind}`)}
                      </th>
                    )}
                    <th className="px-3 py-[10px] font-semibold">{t('documents.col.title')}</th>
                    <th className="w-[150px] px-4 py-[10px] font-semibold">
                      {t('documents.col.status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => (
                    <tr
                      key={d.id}
                      tabIndex={0}
                      aria-label={`${docNumber(d) ?? t('documents.noNumber')} · ${d.title}`}
                      onClick={() => setParam({ doc: d.id })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setParam({ doc: d.id });
                        }
                      }}
                      className={`cursor-pointer border-b border-line last:border-b-0 hover:bg-row-highlight focus-visible:bg-row-highlight focus-visible:outline-none ${
                        d.status === 'annulled' ? 'text-dim' : ''
                      }`}
                    >
                      <td
                        className={`truncate px-4 py-[11px] font-medium ${
                          d.status === 'annulled' ? 'line-through' : 'text-text'
                        }`}
                      >
                        {docNumber(d) ?? (
                          <span className="font-normal text-dim">{t('documents.noNumber')}</span>
                        )}
                      </td>
                      <td className="px-3 py-[11px] text-faint">
                        {formatIsoDate(d.date, 'd MMM', i18n.language).replace('.', '')}
                      </td>
                      {kind !== 'order' && (
                        <td className="truncate px-3 py-[11px] text-sub">{d.party}</td>
                      )}
                      <td className="truncate px-3 py-[11px] text-text">{d.title}</td>
                      <td className="px-4 py-[11px]">
                        <StatusChip status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
        </>
      )}

      <DocumentPanel docId={openId} onClose={() => setParam({ doc: null })} />
      <NewDocumentDialog
        kind={creating}
        onClose={() => setCreating(null)}
        onCreated={(doc) => setParam({ doc: doc.id })}
      />
    </div>
  );
}
