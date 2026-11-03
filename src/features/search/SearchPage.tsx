import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import {
  ArrowRightIcon,
  ChatIcon,
  DocumentsIcon,
  FilesIcon,
  KnowledgeIcon,
  SearchIcon,
  TasksIcon,
} from '@/shared/ui/icons';
import { useSearch } from './api';
import {
  highlight,
  type SearchHit,
  type SearchKind,
  type SearchTarget,
  searchKinds,
  searchStems,
} from './search';

/** Сколько результатов раздела видно во вкладке «Все» */
const PREVIEW = 5;

const kindIcon: Record<SearchKind, ComponentType<{ size?: number; className?: string }>> = {
  tasks: TasksIcon,
  documents: DocumentsIcon,
  knowledge: KnowledgeIcon,
  files: FilesIcon,
  chat: ChatIcon,
};

export function hrefOf(target: SearchTarget): string {
  switch (target.kind) {
    case 'task':
      return `/tasks?task=${target.id}`;
    case 'document':
      return `/documents?kind=${target.docKind}&doc=${target.id}`;
    case 'article':
      return `/knowledge/${target.id}`;
    case 'chat':
      return `/chat?c=${target.chatId}`;
  }
}

const isKind = (v: string | null): v is SearchKind => searchKinds.includes(v as SearchKind);

/**
 * Поиск по системе (S-09): задачи, документы, статьи, файлы, переписка — только то, к чему
 * у пользователя есть доступ. Закрытое не показывается и не считается (приёмка 11.3).
 * Запрос и вкладка — в адресе (?q=устав&in=documents).
 */
export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const inParam = params.get('in');
  const { results, allowed, pending } = useSearch(query);
  const kinds = searchKinds.filter((k) => allowed[k]);
  const tab = isKind(inParam) && allowed[inParam] ? inParam : null;
  const stems = searchStems(query);
  const total = kinds.reduce((n, k) => n + results[k].length, 0);

  usePageSubtitle(stems.length ? t('search.subtitle', { count: total }) : null);

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v) p.set(k, v);
          else p.delete(k);
        }
        return p;
      },
      { replace: true },
    );

  return (
    <div className="flex flex-col gap-3 pb-4 leading-[normal]">
      <label className="flex h-11 items-center gap-3 rounded-12 border border-line bg-panel px-4 focus-within:border-info">
        <SearchIcon size={18} className="shrink-0 text-faint" />
        <span className="sr-only">{t('search.label')}</span>
        <input
          // biome-ignore lint/a11y/noAutofocus: экран поиска открывают, чтобы сразу печатать
          autoFocus
          type="search"
          value={query}
          onChange={(e) => set({ q: e.target.value || null })}
          placeholder={t('search.placeholder')}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-dim"
        />
      </label>

      {stems.length > 0 && (
        <div
          role="tablist"
          aria-label={t('search.label')}
          className="flex h-10 flex-wrap gap-6 px-1"
        >
          {[null, ...kinds].map((k) => {
            const selected = k === tab;
            return (
              <button
                key={k ?? 'all'}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => set({ in: k })}
                className={`relative flex items-center gap-[7px] px-[3px] text-[13px] ${
                  selected ? 'font-semibold text-text' : 'text-sub hover:text-text'
                }`}
              >
                {k ? t(`search.kind.${k}`) : t('search.all')}
                <span
                  className={`text-[11px] font-medium ${selected ? 'text-brand-gold' : 'text-dim'}`}
                >
                  {k ? results[k].length : total}
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
      )}

      {stems.length === 0 ? (
        <p className="rounded-14 border border-line bg-panel px-6 py-10 text-center text-[12.5px] text-dim">
          {t('search.prompt')}
        </p>
      ) : pending ? (
        <p className="px-6 py-10 text-center text-[12.5px] text-dim">{t('search.loading')}</p>
      ) : total === 0 ? (
        <p className="rounded-14 border border-line bg-panel px-6 py-10 text-center text-[12.5px] text-dim">
          {t('search.nothing', { query })}
        </p>
      ) : (
        (tab ? [tab] : kinds)
          .filter((k) => results[k].length > 0)
          .map((k) => {
            const hits = tab ? results[k] : results[k].slice(0, PREVIEW);
            const Icon = kindIcon[k];
            return (
              <section
                key={k}
                aria-label={t(`search.kind.${k}`)}
                className="rounded-14 border border-line bg-panel"
              >
                <h2 className="flex items-center gap-2 px-[18px] pb-2 pt-4 text-[13.5px] font-semibold tracking-[-0.2px] text-text">
                  <Icon size={16} className="text-faint" />
                  {t(`search.kind.${k}`)}
                  <span className="text-[11px] font-medium text-dim">
                    {hits.length < results[k].length
                      ? t('search.shownOf', { shown: hits.length, total: results[k].length })
                      : results[k].length}
                  </span>
                </h2>
                <ul className="pb-[6px]">
                  {hits.map((h) => (
                    <Hit key={h.id} hit={h} stems={stems} />
                  ))}
                </ul>
                {hits.length < results[k].length && (
                  <button
                    type="button"
                    onClick={() => set({ in: k })}
                    className="flex items-center gap-[6px] border-t border-line px-[18px] py-3 text-[12px] font-medium text-info hover:underline"
                  >
                    {t('search.showAll', { count: results[k].length })}
                    <ArrowRightIcon size={14} />
                  </button>
                )}
              </section>
            );
          })
      )}
      {stems.length > 0 && <p className="px-1 text-[11px] text-dim">{t('search.note')}</p>}
    </div>
  );
}

function Marked({ text, stems }: { text: string; stems: string[] }) {
  return (
    <>
      {highlight(text, stems).map((part, i) =>
        part.hit ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: части одной строки, порядок постоянный
          <mark key={i} className="rounded-[3px] bg-warning-chip px-[1px] text-text">
            {part.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: части одной строки, порядок постоянный
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function Hit({ hit, stems }: { hit: SearchHit; stems: string[] }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        to={hrefOf(hit.target)}
        className="block px-[18px] py-[10px] hover:bg-row-highlight focus-visible:bg-row-highlight focus-visible:outline-none"
      >
        <p className="truncate text-[13px] text-text">
          <Marked text={hit.title} stems={stems} />
        </p>
        {hit.subtitle && (
          <p className="mt-[2px] truncate text-[11px] text-dim">
            <Marked text={hit.subtitle} stems={stems} />
          </p>
        )}
        {hit.snippet && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-[17px] text-sub">
            <Marked text={hit.snippet} stems={stems} />
          </p>
        )}
      </Link>
    </li>
  );
}
