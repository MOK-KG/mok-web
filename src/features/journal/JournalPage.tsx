import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { useCan, useSession } from '@/features/auth';
import {
  FieldError,
  FormDialog,
  fieldBox,
  label,
  primaryButton,
  secondaryButton,
} from '@/features/documents/parts';
import { formatInBishkek } from '@/shared/lib/date';
import { toast } from '@/shared/lib/toast';
import { ChevronLeftIcon, DownloadIcon, SearchIcon, ShieldCheckIcon } from '@/shared/ui/icons';
import {
  addJournalEntry,
  groupOf,
  type JournalEntry,
  type JournalGroup,
  journalEntries,
  journalGroups,
  verifyJournal,
} from './store';

const journalKey = ['journal'] as const;

const groups = Object.keys(journalGroups) as JournalGroup[];

/** «Айбек Дуйшеев» → «А. Дуйшеев» */
const shortName = (name: string) => {
  const [first, ...rest] = name.split(' ');
  return rest.length ? `${first.charAt(0)}. ${rest.join(' ')}` : name;
};

/** CSV для выгрузки: разделитель «;», кавычки удваиваются — открывается в Excel */
function toCsv(entries: readonly JournalEntry[]) {
  const cell = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const head = ['id', 'at', 'author', 'action', 'details', 'reason', 'prevHash', 'hash'];
  const rows = entries.map((e) =>
    [e.id, e.at, e.author, e.action, e.details, e.reason ?? '', e.prevHash, e.hash]
      .map(cell)
      .join(';'),
  );
  return `﻿${[head.join(';'), ...rows].join('\n')}\n`;
}

/**
 * Журнал действий (право journal.view): кто, что и когда сделал. Записи нельзя изменить
 * или удалить; цепочка хешей проверяется на экране. Выгрузка для проверки — только
 * у Генерального секретаря (journal.export), с основанием, и сама попадает в журнал
 * (приёмка 11.4, 11.7).
 */
export function JournalPage() {
  const { t, i18n } = useTranslation();
  const { can } = useCan();
  const [group, setGroup] = useState<JournalGroup | null>(null);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const entries = useQuery({
    queryKey: journalKey,
    queryFn: async () => journalEntries(),
    refetchOnMount: 'always',
  }).data;
  const all = entries ?? [];
  const integrity = verifyJournal(all);
  const needle = query.trim().toLocaleLowerCase('ru');
  const inGroup = (e: JournalEntry, g: JournalGroup | null) => !g || groupOf(e.action) === g;
  const matches = (e: JournalEntry) =>
    !needle ||
    [e.author, e.details, e.reason, t(`journal.action.${e.action}`)].some((v) =>
      v?.toLocaleLowerCase('ru').includes(needle),
    );
  const shown = all.filter((e) => inGroup(e, group) && matches(e)).reverse();

  usePageSubtitle(t('journal.subtitle', { count: all.length }));

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-3 leading-[normal]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/access"
          className="flex items-center gap-[6px] text-[12.5px] text-sub hover:text-text"
        >
          <ChevronLeftIcon size={16} />
          {t('sections.access')}
        </Link>
        <div className="flex items-center gap-2">
          <label className="flex h-9 w-[280px] items-center gap-2 rounded-9 border border-line bg-control px-3 text-[12.5px] focus-within:border-info">
            <SearchIcon size={15} className="shrink-0 text-faint" />
            <span className="sr-only">{t('journal.search')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('journal.search')}
              className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-dim"
            />
          </label>
          {can('journal.export') && (
            <button type="button" className={primaryButton} onClick={() => setExporting(true)}>
              <DownloadIcon size={15} />
              {t('journal.export')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex flex-wrap gap-[6px]">
          <legend className="sr-only">{t('journal.groupFilter')}</legend>
          {[null, ...groups].map((g) => {
            const on = g === group;
            return (
              <button
                key={g ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => setGroup(g)}
                className={`flex h-7 items-center gap-[6px] rounded-8 border px-[10px] text-[12px] ${
                  on
                    ? 'border-transparent bg-control-active font-semibold text-text'
                    : 'border-line text-sub hover:text-text'
                }`}
              >
                {g ? t(`journal.group.${g}`) : t('journal.all')}
                <span
                  className={`text-[10.5px] font-medium ${on ? 'text-brand-gold' : 'text-dim'}`}
                >
                  {all.filter((e) => inGroup(e, g) && matches(e)).length}
                </span>
              </button>
            );
          })}
        </fieldset>
        <p
          role="status"
          className={`flex items-center gap-2 text-[12px] ${integrity.ok ? 'text-success' : 'text-danger'}`}
        >
          <ShieldCheckIcon size={15} />
          {integrity.ok
            ? t('journal.integrityOk', { count: integrity.checked })
            : t('journal.integrityBroken', { id: integrity.brokenAt })}
        </p>
      </div>

      <section
        aria-label={t('journal.title')}
        className="min-h-0 flex-1 overflow-auto rounded-14 border border-line bg-panel"
      >
        {shown.length === 0 ? (
          <p className="px-6 py-12 text-center text-[12.5px] text-dim">
            {all.length === 0 ? t('journal.empty') : t('journal.nothingFound')}
          </p>
        ) : (
          <table className="w-full table-fixed text-left text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[1px] text-dim">
                <th className="w-[140px] px-4 py-[10px] font-semibold">{t('journal.col.at')}</th>
                <th className="w-[140px] px-3 py-[10px] font-semibold">
                  {t('journal.col.author')}
                </th>
                <th className="w-[200px] px-3 py-[10px] font-semibold">
                  {t('journal.col.action')}
                </th>
                <th className="px-3 py-[10px] font-semibold">{t('journal.col.details')}</th>
                <th className="w-[100px] px-4 py-[10px] font-semibold">{t('journal.col.hash')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className="border-b border-line align-top last:border-b-0">
                  <td className="px-4 py-[10px] text-faint">
                    {formatInBishkek(e.at, 'd MMM, HH:mm', i18n.language)}
                  </td>
                  <td className="truncate px-3 py-[10px] text-text">{e.author}</td>
                  <td
                    className={`px-3 py-[10px] ${e.action === 'accessDenied' ? 'text-danger' : 'text-sub'}`}
                  >
                    {t(`journal.action.${e.action}`)}
                  </td>
                  <td className="px-3 py-[10px] text-sub">
                    <span className="break-words">{e.details}</span>
                    {e.reason && (
                      <span className="mt-[2px] block text-[11.5px] text-faint">
                        {t('journal.reason', { reason: e.reason })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-[10px] font-mono text-[11px] text-dim" title={e.hash}>
                    {e.hash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="px-1 text-[11px] text-dim">{t('journal.note')}</p>

      <ExportDialog open={exporting} onClose={() => setExporting(false)} />
    </div>
  );
}

function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const user = useSession().data?.user;
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const error = reason.trim().length < 5 ? t('journal.errorReason') : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (error) return;
    // Сначала — запись о выгрузке, чтобы она сама попала в файл
    addJournalEntry({
      author: user ? shortName(user.name) : '—',
      action: 'journalExported',
      details: t('journal.exportDetails', { count: journalEntries().length + 1 }),
      reason: reason.trim(),
    });
    const blob = new Blob([toCsv(journalEntries())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    client.invalidateQueries({ queryKey: journalKey });
    toast.success({ title: t('journal.exported') });
    setReason('');
    setTried(false);
    onClose();
  };

  return (
    <FormDialog open={open} title={t('journal.export')} onClose={onClose} width={480}>
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-3">
        <p className="text-[12px] leading-[17px] text-faint">{t('journal.exportHint')}</p>
        <div>
          <label htmlFor="export-reason" className={label}>
            {t('journal.exportReason')}
          </label>
          <textarea
            id="export-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={tried && !!error}
            data-invalid={tried && !!error}
            className={`${fieldBox} mt-[6px] py-[9px]`}
            placeholder={t('journal.exportPlaceholder')}
          />
          <FieldError text={tried ? error : null} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButton} onClick={onClose}>
            {t('documents.cancel')}
          </button>
          <button type="submit" className={primaryButton}>
            {t('journal.exportSubmit')}
          </button>
        </div>
      </form>
    </FormDialog>
  );
}
