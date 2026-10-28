import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { Can, useCan } from '@/features/auth';
import type { Person } from '@/features/tasks/types';
import {
  BookIcon,
  CheckboxCheckIcon,
  ClearIcon,
  DocMiniIcon,
  FilterIcon,
  FolderIcon,
  LockIcon,
  MoreIcon,
  PlusIcon,
  PlusSmallIcon,
  SearchIcon,
  ShieldCheckIcon,
  TasksMiniIcon,
} from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import { AccessDialog } from './AccessDialog';
import { useKnowledge, useKnowledgeSearch, useMoveSection } from './api';
import { Avatar, capsTitle, FreshnessBadge, useShortDate } from './parts';
import { SectionDialog } from './SectionDialog';
import { checkedAt, freshnessOf, queryStems } from './search';
import type { KbArticleSummary, KbFreshness, KbHiddenMatches, KbSection } from './types';

type Filters = { freshness: Exclude<KbFreshness, null>[]; authors: string[] };

const parseList = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);

/**
 * Раздел «База знаний»: разделы слева, статьи справа, поиск с учётом прав.
 * Раздел, запрос и фильтр — в адресе (?section=&q=&fresh=&author=): со статьи можно вернуться
 * к тому же списку, а ссылкой — поделиться.
 */
export function KnowledgePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const list = useKnowledge();

  const sectionId = params.get('section');
  const query = params.get('q') ?? '';
  const searching = queryStems(query).length > 0;
  const deferredQuery = useDeferredValue(query);
  const search = useKnowledgeSearch(deferredQuery);
  const filters: Filters = {
    freshness: parseList(params.get('fresh')) as Filters['freshness'],
    authors: parseList(params.get('author')),
  };

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [key, value] of Object.entries(changes)) {
          if (value) p.set(key, value);
          else p.delete(key);
        }
        return p;
      },
      { replace: true },
    );

  const sections = list.data?.sections ?? [];
  const articles = list.data?.articles ?? [];
  const openSections = sections.filter((s) => s.accessible);
  const current = openSections.find((s) => s.id === sectionId) ?? null;

  usePageSubtitle(
    list.data
      ? `${t('knowledge.articles', { count: articles.length })} ${t('knowledge.inSections', {
          count: openSections.length,
        })}`
      : null,
  );

  const filtered = useMemo(
    () =>
      articles.filter(
        (a) =>
          (filters.freshness.length === 0 ||
            filters.freshness.includes(freshnessOf(checkedAt(a)) as never)) &&
          (filters.authors.length === 0 || filters.authors.includes(a.author.id)),
      ),
    [articles, filters.freshness, filters.authors],
  );
  const filterActive = filters.freshness.length + filters.authors.length > 0;

  // Найденные — из ответа поиска; пока запрос пуст, ничего не подсвечиваем
  const foundIds = new Set(searching ? (search.data?.ids ?? []) : []);
  const inSection = filtered.filter((a) => !current || a.sectionId === current.id);
  const shown = [
    ...inSection.filter((a) => foundIds.has(a.id)),
    ...inSection.filter((a) => !foundIds.has(a.id)),
  ];
  const foundTotal = filtered.filter((a) => foundIds.has(a.id)).length;
  const foundHere = shown.filter((a) => foundIds.has(a.id)).length;
  const sectionTotal = current ? current.count : articles.length;

  return (
    <div className="flex h-full min-h-[560px] flex-col leading-[normal]">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 px-1">
        <SearchField value={query} onChange={(q) => update({ q })} />
        <div className="flex items-center gap-2">
          <FilterMenu
            articles={articles}
            value={filters}
            onChange={(f) => update({ fresh: f.freshness.join(','), author: f.authors.join(',') })}
          />
          <Can permission="knowledge.edit">
            <Link
              to={`/knowledge/new${current ? `?section=${current.id}` : ''}`}
              className="flex h-8 items-center gap-[5px] rounded-9 bg-brand-red px-3 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90"
            >
              <PlusIcon size={16} />
              {t('knowledge.newArticle')}
            </Link>
          </Can>
        </div>
      </div>

      {searching && search.data && (
        <output className="mt-[10px] flex h-10 shrink-0 items-center gap-2 rounded-9 border border-info-line bg-notice-info px-[13px]">
          <ShieldCheckIcon size={16} className="shrink-0 text-info" />
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-medium tracking-[-0.1px] text-notice-info-title">
              {foundTotal > 0
                ? t('knowledge.found', { count: foundTotal, query: query.trim() })
                : t('knowledge.nothingFound', { query: query.trim() })}
            </span>
            <span className="block truncate text-[10.5px] text-notice-info-text">
              {t('knowledge.foundNote')}
            </span>
          </span>
        </output>
      )}

      <div className="mt-3 flex min-h-0 flex-1 gap-[14px]">
        <SectionsNav
          sections={sections}
          total={articles.length}
          current={current}
          onSelect={(id) => update({ section: id })}
        />

        <section
          aria-label={current?.name ?? t('knowledge.allArticles')}
          className="min-w-0 flex-1 overflow-y-auto rounded-14 border border-line bg-panel"
        >
          <header className="flex h-[52px] items-center gap-[14px] border-b border-line px-5">
            <h2 className="text-[15px] font-semibold tracking-[-0.2px] text-text">
              {current?.name ?? t('knowledge.allArticles')}
            </h2>
            <p className="text-[11.5px] text-faint">
              {[
                t('knowledge.articles', { count: sectionTotal }),
                filterActive && t('knowledge.byFilter', { count: shown.length }),
                searching && search.data && t('knowledge.foundInSection', { count: foundHere }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </header>

          {list.isError ? (
            <p className="px-5 py-10 text-center text-[12px] text-faint">
              {t('knowledge.loadError')}
            </p>
          ) : (
            <ul className="pt-[11px]">
              {shown.map((a, i) => (
                <ArticleRow
                  key={a.id}
                  article={a}
                  found={foundIds.has(a.id)}
                  separator={i > 0}
                  backTo={params.toString()}
                />
              ))}
            </ul>
          )}
          {list.isSuccess && shown.length === 0 && (
            <p className="px-5 py-10 text-center text-[12px] text-faint">
              {filterActive ? t('knowledge.emptyFilter') : t('knowledge.empty')}
            </p>
          )}
          {searching &&
            search.data?.hidden.map((h) => <HiddenMatches key={h.sectionId} hidden={h} />)}
        </section>
      </div>
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const { t } = useTranslation();
  const active = value !== '';
  return (
    <label
      className={`group flex h-8 w-[340px] items-center gap-2 rounded-9 border bg-panel pl-[9px] pr-[6px] focus-within:border-info ${
        active ? 'border-info' : 'border-line'
      }`}
    >
      <SearchIcon
        size={16}
        className={`shrink-0 group-focus-within:text-info ${active ? 'text-info' : 'text-faint'}`}
      />
      <span className="sr-only">{t('knowledge.search')}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('knowledge.search')}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-text outline-none placeholder:text-dim [&::-webkit-search-cancel-button]:hidden"
      />
      {active && (
        <Tooltip content={t('knowledge.clearSearch')}>
          <button
            type="button"
            aria-label={t('knowledge.clearSearch')}
            onClick={() => onChange('')}
            className="flex size-[18px] items-center justify-center rounded-[5px] text-faint hover:bg-row-highlight hover:text-text"
          >
            <ClearIcon size={12} />
          </button>
        </Tooltip>
      )}
    </label>
  );
}

function SectionsNav({
  sections,
  total,
  current,
  onSelect,
}: {
  sections: KbSection[];
  total: number;
  current: KbSection | null;
  onSelect: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const { can } = useCan();
  const editable = can('knowledge.edit');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<KbSection | null>(null);
  const [access, setAccess] = useState<KbSection | null>(null);
  const move = useMoveSection();
  const closed = sections.filter((s) => !s.accessible);
  const item =
    'relative flex h-[38px] w-full items-center gap-[11px] rounded-8 px-3 text-left text-[12.5px] tracking-[-0.1px]';
  const stateOf = (selected: boolean) =>
    selected
      ? 'bg-nav-active font-semibold text-text'
      : 'text-sub hover:bg-row-highlight hover:text-text';
  const stripe = (
    <span
      aria-hidden
      className="absolute left-0 top-[9px] h-5 w-[2.5px] rounded-[1.5px] bg-brand-red"
    />
  );
  // У раздела с меню число прячется под кнопкой «…», пока на строку наведены
  const count = (n: number, menu = false) => (
    <span
      className={`ml-auto text-[10.5px] font-normal text-dim ${
        menu ? 'group-focus-within:invisible group-hover:invisible' : ''
      }`}
    >
      {n}
    </span>
  );

  return (
    <nav
      aria-label={t('knowledge.sectionsTitle')}
      className="w-[280px] shrink-0 overflow-y-auto rounded-14 border border-line bg-nav-panel"
    >
      <div className="flex h-[45px] items-start justify-between border-b border-line pl-[18px] pr-[10px] pt-3">
        <h2 className={`${capsTitle} mt-[6px]`}>{t('knowledge.sectionsTitle')}</h2>
        <Can permission="knowledge.edit">
          <Tooltip content={t('knowledge.newSection')}>
            <button
              type="button"
              aria-label={t('knowledge.newSection')}
              onClick={() => setCreating(true)}
              className="flex size-6 items-center justify-center rounded-6 text-faint hover:bg-row-highlight hover:text-text"
            >
              <PlusSmallIcon size={12} />
            </button>
          </Tooltip>
          <SectionDialog
            open={creating}
            onClose={() => setCreating(false)}
            onCreated={(s) => onSelect(s.id)}
          />
        </Can>
      </div>
      <ul className="px-[7px] pt-[10px]">
        <li>
          <button
            type="button"
            aria-current={current === null ? 'page' : undefined}
            onClick={() => onSelect(null)}
            className={`${item} ${stateOf(current === null)}`}
          >
            {current === null && stripe}
            <BookIcon size={17} className="shrink-0" />
            {t('knowledge.allArticles')}
            {count(total)}
          </button>
        </li>
        {sections.map((s, i) => {
          const selected = current?.id === s.id;
          return (
            <li key={s.id} className="group relative">
              {s.accessible ? (
                <>
                  <button
                    type="button"
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => onSelect(s.id)}
                    className={`${item} ${stateOf(selected)}`}
                  >
                    {selected && stripe}
                    <FolderIcon size={17} className="shrink-0" />
                    <span className="truncate">{s.name}</span>
                    {s.roles && (
                      <Tooltip content={t('knowledge.openTo', { roles: s.roles.join(', ') })}>
                        <span className="flex shrink-0 text-dim">
                          <ShieldCheckIcon size={13} />
                          <span className="sr-only">
                            {t('knowledge.openTo', { roles: s.roles.join(', ') })}
                          </span>
                        </span>
                      </Tooltip>
                    )}
                    {count(s.count, editable)}
                  </button>
                  {editable && (
                    <SectionMenu
                      section={s}
                      first={i === 0}
                      last={i === sections.length - 1}
                      onRename={() => setRenaming(s)}
                      onAccess={() => setAccess(s)}
                      onMove={(by) => move.mutate({ id: s.id, by })}
                    />
                  )}
                </>
              ) : (
                // Закрытый раздел виден, но не открывается
                <Tooltip content={t('knowledge.closedSection')} side="right">
                  <span className={`${item} cursor-not-allowed text-dim`} aria-disabled>
                    <LockIcon size={17} className="shrink-0" />
                    <span className="truncate">{s.name}</span>
                    <span className="sr-only">. {t('knowledge.closedSection')}</span>
                    {count(s.count)}
                  </span>
                </Tooltip>
              )}
            </li>
          );
        })}
      </ul>
      <AccessDialog section={access} onClose={() => setAccess(null)} />
      <SectionDialog
        open={renaming !== null}
        section={renaming ?? undefined}
        onClose={() => setRenaming(null)}
        onCreated={() => {}}
      />
      {closed.length > 0 && (
        <p className="mx-[10px] mt-[10px] border-t border-line px-2 pb-4 pt-[13px] text-[10.5px] leading-[15px] text-dim">
          {t('knowledge.closedNote', {
            count: closed.length,
            names: closed.map((s) => (closed.length > 1 ? `«${s.name}»` : s.name)).join(', '),
          })}
        </p>
      )}
    </nav>
  );
}

/** Меню раздела (право knowledge.edit): переименовать, доступ, сдвинуть. Удалять разделы нельзя */
function SectionMenu({
  section,
  first,
  last,
  onRename,
  onAccess,
  onMove,
}: {
  section: KbSection;
  first: boolean;
  last: boolean;
  onRename: () => void;
  onAccess: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const row =
    'flex h-[34px] cursor-pointer items-center rounded-[7px] px-3 text-[12px] text-sub outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-popover-active data-[highlighted]:text-text data-[disabled]:opacity-40';
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`${t('knowledge.sectionMenu')}: ${section.name}`}
        className="absolute right-[6px] top-[7px] flex size-6 items-center justify-center rounded-6 text-faint opacity-0 hover:bg-row-highlight hover:text-text focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
      >
        <MoreIcon size={14} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          side="right"
          sideOffset={6}
          className="z-50 w-[200px] rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        >
          <DropdownMenu.Item onSelect={onRename} className={row}>
            {t('knowledge.renameSection')}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onAccess} className={row}>
            {t('knowledge.accessMenu')}
          </DropdownMenu.Item>
          <DropdownMenu.Item disabled={first} onSelect={() => onMove(-1)} className={row}>
            {t('knowledge.moveUp')}
          </DropdownMenu.Item>
          <DropdownMenu.Item disabled={last} onSelect={() => onMove(1)} className={row}>
            {t('knowledge.moveDown')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ArticleRow({
  article: a,
  found,
  separator,
  backTo,
}: {
  article: KbArticleSummary;
  found: boolean;
  separator: boolean;
  backTo: string;
}) {
  const { t } = useTranslation();
  const shortDate = useShortDate();
  return (
    <li>
      {separator && <div aria-hidden className="mx-5 h-px bg-line" />}
      <Link
        to={`/knowledge/${a.id}`}
        state={{ backTo }}
        className={`relative block px-5 pb-[10px] pt-4 outline-none focus-visible:bg-row-highlight ${
          found ? 'bg-row-match' : 'hover:bg-row-highlight'
        }`}
      >
        {found && <span aria-hidden className="absolute inset-y-0 left-0 w-[2.5px] bg-info" />}
        <span className="block pr-[130px] text-[13.5px] font-medium tracking-[-0.15px] text-text">
          {a.title}
        </span>
        {/* Метка не увеличивает высоту строки: в макете она ниже заголовка на 4 px */}
        <span className="absolute right-5 top-4">
          <FreshnessBadge freshness={freshnessOf(checkedAt(a))} />
        </span>
        <span className="mt-[6px] block pr-[120px] text-[12px] leading-[18px] text-faint">
          {a.summary}
        </span>
        <span className="mt-2 flex items-center text-[10.5px]">
          <Avatar person={a.author} size={20} />
          <span className="ml-[6px] text-sub">{a.author.short}</span>
          <span aria-hidden className="mx-2 text-dim">
            ·
          </span>
          <span className="text-dim">
            {t('knowledge.updated', { date: shortDate(a.updatedAt) })}
          </span>
          <span className="ml-auto flex items-center gap-[10px] text-faint">
            {a.tasksCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="sr-only">
                  {t('knowledge.tasksCount', { count: a.tasksCount })}
                </span>
                <TasksMiniIcon size={13} className="text-dim" />
                <span aria-hidden>{a.tasksCount}</span>
              </span>
            )}
            {a.documentsCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="sr-only">
                  {t('knowledge.documentsCount', { count: a.documentsCount })}
                </span>
                <DocMiniIcon size={13} className="text-dim" />
                <span aria-hidden>{a.documentsCount}</span>
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

function HiddenMatches({ hidden }: { hidden: KbHiddenMatches }) {
  const { t } = useTranslation();
  return (
    <div className="mx-5 my-4 flex items-center gap-2 rounded-9 border border-line bg-muted-soft px-[13px] py-2">
      <ShieldCheckIcon size={16} className="shrink-0 text-dim" />
      <div className="min-w-0">
        <p className="text-[11.5px] font-medium tracking-[-0.1px] text-faint">
          {t('knowledge.hidden', { count: hidden.count, section: hidden.sectionName })}
        </p>
        <p className="mt-[2px] text-[10.5px] text-dim">{t('knowledge.hiddenNote')}</p>
      </div>
    </div>
  );
}

const field =
  'flex h-8 items-center gap-[6px] rounded-9 border px-[10px] text-[12.5px] font-medium tracking-[-0.1px]';

/** Фильтр по актуальности и автору; применяется сразу, счётчики — по доступным статьям */
function FilterMenu({
  articles,
  value,
  onChange,
}: {
  articles: KbArticleSummary[];
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const { t } = useTranslation();
  const active = value.freshness.length + value.authors.length > 0;
  const authors = [
    ...new Map<string, Person>(articles.map((a) => [a.author.id, a.author])).values(),
  ].sort((a, b) => a.short.localeCompare(b.short));
  const toggle = <T extends string>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const row =
    'flex h-8 cursor-pointer items-center gap-[10px] rounded-[7px] px-[10px] text-[12px] tracking-[-0.1px] text-sub outline-none data-[highlighted]:bg-popover-active data-[highlighted]:text-text data-[state=checked]:font-medium data-[state=checked]:text-text';
  const legend =
    'px-[10px] pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-dim';

  const box = (checked: boolean) => (
    <span
      aria-hidden
      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] ${
        checked ? 'bg-info text-panel' : 'border-[1.4px] border-dim'
      }`}
    >
      {checked && <CheckboxCheckIcon size={11} />}
    </span>
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`${field} ${
          active
            ? 'border-info bg-popover-active text-text'
            : 'border-line bg-panel text-sub hover:text-text data-[state=open]:text-text'
        }`}
      >
        <FilterIcon size={16} className="shrink-0" />
        {t('knowledge.filter')}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 max-h-[420px] w-[260px] overflow-y-auto rounded-12 border border-line bg-popover p-[5px] shadow-[0_10px_32px_rgba(0,0,0,0.45)]"
        >
          <DropdownMenu.Label className={legend}>
            {t('knowledge.filterFreshness')}
          </DropdownMenu.Label>
          {(['fresh', 'stale'] as const).map((f) => {
            const checked = value.freshness.includes(f);
            return (
              <DropdownMenu.CheckboxItem
                key={f}
                checked={checked}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() =>
                  onChange({ ...value, freshness: toggle(value.freshness, f) })
                }
                className={row}
              >
                {box(checked)}
                <span className="flex-1">{t(`knowledge.${f}`)}</span>
                <span className="text-[10.5px] font-normal text-dim">
                  {articles.filter((a) => freshnessOf(checkedAt(a)) === f).length}
                </span>
              </DropdownMenu.CheckboxItem>
            );
          })}
          <DropdownMenu.Separator className="my-[5px] h-px bg-line" />
          <DropdownMenu.Label className={legend}>{t('knowledge.filterAuthor')}</DropdownMenu.Label>
          {authors.map((p) => {
            const checked = value.authors.includes(p.id);
            return (
              <DropdownMenu.CheckboxItem
                key={p.id}
                checked={checked}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => onChange({ ...value, authors: toggle(value.authors, p.id) })}
                className={row}
              >
                {box(checked)}
                <span className="flex-1">{p.short}</span>
                <span className="text-[10.5px] font-normal text-dim">
                  {articles.filter((a) => a.author.id === p.id).length}
                </span>
              </DropdownMenu.CheckboxItem>
            );
          })}
          {active && (
            <>
              <DropdownMenu.Separator className="my-[5px] h-px bg-line" />
              <DropdownMenu.Item
                onSelect={() => onChange({ freshness: [], authors: [] })}
                className={`${row} font-medium text-info`}
              >
                {t('knowledge.filterReset')}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
