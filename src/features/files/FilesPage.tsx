import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { attachmentUrl } from '@/features/knowledge-base/api';
import { formatInBishkek } from '@/shared/lib/date';
import { DownloadIcon, SearchIcon } from '@/shared/ui/icons';
import { useFiles } from './api';
import {
  type FileItem,
  type FileSource,
  type FileTarget,
  type FileType,
  fileSources,
  fileTypes,
  filterFiles,
  formatSize,
} from './collect';

/** Цвет метки расширения по типу файла */
const typeBadge: Record<FileType, string> = {
  pdf: 'bg-tone-red-bg text-tone-red',
  doc: 'bg-tone-blue-bg text-tone-blue',
  sheet: 'bg-tone-green-bg text-tone-green',
  image: 'bg-tone-purple-bg text-tone-purple',
  other: 'bg-chip text-chip-text',
};

const isSource = (v: string | null): v is FileSource => fileSources.includes(v as FileSource);
const isType = (v: string | null): v is FileType => fileTypes.includes(v as FileType);

export const targetHref = (target: FileTarget) =>
  target.kind === 'document'
    ? `/documents?kind=${target.docKind}&doc=${target.id}`
    : target.kind === 'article'
      ? `/knowledge/${target.id}`
      : `/chat?c=${target.chatId}`;

/** Скачать: вложение статьи — с бэкенда Базы знаний, остальное — демо-файл до бэкенда */
function download(file: FileItem) {
  const full = file.ext ? `${file.name}.${file.ext}` : file.name;
  const a = document.createElement('a');
  a.download = full;
  if (file.target.kind === 'article') {
    a.href = attachmentUrl(file.id.split(':')[2]);
    a.click();
    return;
  }
  const blob = new Blob(
    [`${full}\n\nДемо-файл: настоящий файл появится после подключения хранилища.\n`],
    { type: 'text/plain' },
  );
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Файлы: все вложения из Документов, Базы знаний и Чата, к которым у пользователя есть доступ.
 * Раздел и тип — в адресе (?source=chat&type=pdf). Файл открывается там, где он лежит.
 * Макета нет.
 */
export function FilesPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { items, pending, allowed } = useFiles();
  const [query, setQuery] = useState('');
  const sources = fileSources.filter((s) => allowed[s]);
  const sourceParam = params.get('source');
  const source = isSource(sourceParam) && allowed[sourceParam] ? sourceParam : null;
  const typeParam = params.get('type');
  const type = isType(typeParam) ? typeParam : null;

  const inSource = filterFiles(items, { source, type: null, query });
  const shown = filterFiles(inSource, { source: null, type, query: '' });
  const units = { kb: t('files.kb'), mb: t('files.mb') };

  usePageSubtitle(t('files.subtitle', { count: items.length }));

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-3 leading-[normal]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t('sections.files')} className="flex h-10 gap-6 px-1">
          {[null, ...sources].map((s) => {
            const selected = s === source;
            const count = filterFiles(items, { source: s, type: null, query }).length;
            return (
              <button
                key={s ?? 'all'}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setParam('source', s)}
                className={`relative flex items-center gap-[7px] px-[3px] text-[13px] ${
                  selected ? 'font-semibold text-text' : 'text-sub hover:text-text'
                }`}
              >
                {s ? t(`files.source.${s}`) : t('files.all')}
                <span
                  className={`text-[11px] font-medium ${selected ? 'text-brand-gold' : 'text-dim'}`}
                >
                  {count}
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
        </div>
        <label className="flex h-9 w-[280px] items-center gap-2 rounded-9 border border-line bg-control px-3 text-[12.5px] focus-within:border-info">
          <SearchIcon size={15} className="shrink-0 text-faint" />
          <span className="sr-only">{t('files.search')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('files.search')}
            className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-dim"
          />
        </label>
      </div>

      <fieldset className="flex flex-wrap gap-[6px]">
        <legend className="sr-only">{t('files.typeFilter')}</legend>
        {[null, ...fileTypes].map((x) => {
          const on = x === type;
          const count = x ? inSource.filter((f) => f.type === x).length : inSource.length;
          if (x && count === 0 && !on) return null;
          return (
            <button
              key={x ?? 'all'}
              type="button"
              aria-pressed={on}
              onClick={() => setParam('type', x)}
              className={`flex h-7 items-center gap-[6px] rounded-8 border px-[10px] text-[12px] ${
                on
                  ? 'border-transparent bg-control-active font-semibold text-text'
                  : 'border-line text-sub hover:text-text'
              }`}
            >
              {x ? t(`files.type.${x}`) : t('files.anyType')}
              <span className={`text-[10.5px] font-medium ${on ? 'text-brand-gold' : 'text-dim'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </fieldset>

      <section
        aria-label={t('sections.files')}
        className="min-h-0 flex-1 overflow-auto rounded-14 border border-line bg-panel"
      >
        {pending ? (
          <p className="px-6 py-12 text-center text-[12.5px] text-dim">{t('files.loading')}</p>
        ) : shown.length === 0 ? (
          <p className="px-6 py-12 text-center text-[12.5px] text-dim">
            {query || type || source ? t('files.nothingFound') : t('files.empty')}
          </p>
        ) : (
          <table className="w-full table-fixed text-left text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-panel">
              <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[1px] text-dim">
                <th className="px-4 py-[10px] font-semibold">{t('files.col.name')}</th>
                <th className="w-[32%] px-3 py-[10px] font-semibold">{t('files.col.place')}</th>
                <th className="w-[140px] px-3 py-[10px] font-semibold">{t('files.col.addedBy')}</th>
                <th className="w-[120px] px-3 py-[10px] font-semibold">{t('files.col.date')}</th>
                <th className="w-[56px] px-3 py-[10px]">
                  <span className="sr-only">{t('files.download')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => {
                const size = formatSize(f.size, units);
                return (
                  <tr key={f.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-[10px]">
                      <span className="flex min-w-0 items-center gap-[10px]">
                        <span
                          className={`flex h-6 w-10 shrink-0 items-center justify-center rounded-6 text-[9.5px] font-semibold uppercase ${typeBadge[f.type]}`}
                        >
                          {f.ext || '—'}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-text">{f.name}</span>
                          <span className="block text-[11px] text-dim">
                            {t(`files.source.${f.source}`)}
                            {size && ` · ${size}`}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-[10px]">
                      <Link
                        to={targetHref(f.target)}
                        className="block truncate text-sub hover:text-info hover:underline"
                      >
                        {f.place}
                      </Link>
                    </td>
                    <td className="truncate px-3 py-[10px] text-sub">{f.addedBy ?? '—'}</td>
                    <td className="px-3 py-[10px] text-faint">
                      {formatInBishkek(f.at, 'd MMM yyyy', i18n.language).replace('.', '')}
                    </td>
                    <td className="px-3 py-[10px]">
                      <button
                        type="button"
                        onClick={() => download(f)}
                        aria-label={t('files.downloadName', { name: `${f.name}.${f.ext}` })}
                        className="flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
                      >
                        <DownloadIcon size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <p className="px-1 text-[11px] text-dim">{t('files.note')}</p>
    </div>
  );
}
