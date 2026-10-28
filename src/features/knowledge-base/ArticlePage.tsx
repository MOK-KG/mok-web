import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { Can, ForbiddenPage, useCan } from '@/features/auth';
import type { TaskStatus } from '@/features/tasks/types';
import { ApiError } from '@/shared/api/errors';
import { formatIsoDate } from '@/shared/lib/date';
import { toast } from '@/shared/lib/toast';
import {
  AttachLargeIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
  DocSmallIcon,
  DownloadIcon,
  EditMediumIcon,
  HistoryClockIcon,
  MoreIcon,
  TasksSmallIcon,
} from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useArticle, useKnowledge, useMarkReviewed } from './api';
import { DocumentDialog } from './DocumentDialog';
import {
  Avatar,
  capsTitle,
  FreshnessBadge,
  openAttachment,
  useFileSize,
  useShortDate,
} from './parts';
import { checkedAt, freshnessOf } from './search';
import type { KbArticle, KbBlock, KbRelatedDocument, KbVersion } from './types';

const ATTACHMENTS_ID = 'attachments';

// Высота карточки статьи и боковой панели: экран без шапки (102 px) и хлебных крошек (36 px)
const panelHeight = 'min-h-[calc(100vh-138px)]';

/** Статья базы знаний: текст, вложения; справа — содержание, связи и история версий */
export function ArticlePage() {
  const { t } = useTranslation();
  const { articleId = '' } = useParams();
  const article = useArticle(articleId);
  const section = useKnowledge().data?.sections.find((s) => s.id === article.data?.sectionId);
  // Назад — к тому же списку (раздел, запрос, фильтр), откуда открыли статью
  const backTo = (useLocation().state as { backTo?: string } | null)?.backTo;
  const listUrl = backTo
    ? `/knowledge?${backTo}`
    : `/knowledge${section ? `?section=${section.id}` : ''}`;

  usePageSubtitle(section?.name);

  if (article.error instanceof ApiError && article.error.status === 403) return <ForbiddenPage />;
  if (article.isError) {
    const notFound = article.error instanceof ApiError && article.error.status === 404;
    return (
      <section className="mx-auto mt-16 max-w-[420px] rounded-18 border border-line bg-panel p-8 text-center">
        <h2 className="text-[18px] font-semibold tracking-[-0.3px] text-text">
          {notFound ? t('knowledge.notFoundTitle') : t('knowledge.loadError')}
        </h2>
        {notFound && <p className="mt-2 text-[13px] text-sub">{t('knowledge.notFoundText')}</p>}
        <Link
          to="/knowledge"
          className="mt-5 inline-block rounded-9 bg-surface px-4 py-2 text-[12.5px] font-medium text-text hover:opacity-90"
        >
          {t('knowledge.toList')}
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col leading-[normal]">
      <nav
        aria-label={t('knowledge.back')}
        className="-mt-[2px] flex h-7 shrink-0 items-center text-[12.5px]"
      >
        <Tooltip content={t('knowledge.back')}>
          <Link
            to={listUrl}
            aria-label={t('knowledge.back')}
            className="mr-[6px] flex size-6 items-center justify-center rounded-6 text-sub hover:bg-row-highlight hover:text-text"
          >
            <ChevronLeftIcon size={16} />
          </Link>
        </Tooltip>
        <Link to="/knowledge" className="text-sub hover:text-text">
          {t('sections.knowledge')}
        </Link>
        {section && (
          <>
            <span aria-hidden className="mx-[10px] text-dim">
              /
            </span>
            <Link
              to={`/knowledge?section=${section.id}`}
              className="font-medium text-faint hover:text-text"
            >
              {section.name}
            </Link>
          </>
        )}
      </nav>

      {article.data && <ArticleBody article={article.data} />}
    </div>
  );
}

/** Старая версия из ?version=N; текущая или неизвестная — null */
function useViewedVersion(article: KbArticle): KbVersion | null {
  const [params] = useSearchParams();
  const number = Number(params.get('version'));
  if (!number || number === article.version) return null;
  return article.versions.find((v) => v.number === number) ?? null;
}

function ArticleBody({ article: current }: { article: KbArticle }) {
  const { t, i18n } = useTranslation();
  const shortDate = useShortDate();
  const location = useLocation();
  const old = useViewedVersion(current);
  // Старая версия — только для чтения: её текст на месте текущего, вложения и связи — текущие
  const a: KbArticle = old
    ? { ...current, title: old.title, summary: old.summary, body: old.body }
    : current;
  // Блоки, которых нет в текущей версии: их потом изменили или убрали
  const currentBlocks = new Set(current.body.map((b) => JSON.stringify(b)));
  const review = useMarkReviewed(current.id);
  const fileSize = useFileSize();
  const freshness = freshnessOf(checkedAt(current));
  const reviewedLater = current.reviewed && current.reviewed.date > current.updatedAt;
  const toc = [
    ...a.body.flatMap((b) => (b.kind === 'heading' ? [{ id: b.id, text: b.text }] : [])),
    ...(a.attachments.length > 0 ? [{ id: ATTACHMENTS_ID, text: t('knowledge.attachments') }] : []),
  ];
  const ref = useRef<HTMLElement>(null);
  const active = useActiveHeading(
    ref,
    toc.map((x) => x.id),
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success({ title: t('knowledge.linkCopied') });
    } catch {
      toast.error({ title: t('errors.unknown') });
    }
  };

  return (
    <div className="mt-[10px] flex items-start gap-4">
      <article
        ref={ref}
        className={`min-w-0 flex-1 rounded-14 border border-line bg-panel px-[23px] pb-6 pt-[23px] ${panelHeight}`}
      >
        <div className="flex min-h-7 items-start justify-between gap-3">
          {!old && <FreshnessBadge freshness={freshness} large />}
          <div className="ml-auto flex items-center gap-2">
            <Can permission="knowledge.edit">
              {!old && freshness !== 'fresh' && (
                <Tooltip content={t('knowledge.reviewHint')}>
                  <button
                    type="button"
                    disabled={review.isPending}
                    onClick={() => review.mutate()}
                    className="flex h-7 items-center gap-[5px] rounded-[7px] border border-line px-[10px] text-[11.5px] font-medium text-sub hover:text-text disabled:opacity-60"
                  >
                    <CheckIcon size={14} />
                    {t('knowledge.review')}
                  </button>
                </Tooltip>
              )}
            </Can>
            <Can permission="knowledge.edit">
              {!old && (
                <Link
                  to={`/knowledge/${a.id}/edit`}
                  className="flex h-7 w-[92px] items-center justify-center gap-[5px] rounded-[7px] border border-line text-[11.5px] font-medium text-sub hover:text-text"
                >
                  <EditMediumIcon size={16} />
                  {t('knowledge.edit')}
                </Link>
              )}
            </Can>
            <DropdownMenu.Root>
              <Tooltip content={t('knowledge.more')}>
                <DropdownMenu.Trigger
                  aria-label={t('knowledge.more')}
                  className="flex h-7 w-8 items-center justify-center rounded-[7px] text-sub hover:bg-row-highlight hover:text-text data-[state=open]:bg-row-highlight"
                >
                  <MoreIcon size={16} />
                </DropdownMenu.Trigger>
              </Tooltip>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 w-[200px] rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
                >
                  <DropdownMenu.Item
                    onSelect={copyLink}
                    className="flex h-[34px] cursor-pointer items-center rounded-[7px] px-3 text-[12px] text-sub outline-none data-[highlighted]:bg-popover-active data-[highlighted]:text-text"
                  >
                    {t('knowledge.copyLink')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        {old && (
          <div
            role="status"
            className="mb-2 mt-3 flex items-center gap-[10px] rounded-9 border border-info-line bg-info-chip px-[13px] py-[10px] text-[12px]"
          >
            <HistoryClockIcon size={16} className="shrink-0 text-info" />
            <span className="min-w-0 flex-1 text-sub">
              <span className="font-semibold text-text">
                {t('knowledge.viewingVersion', {
                  number: old.number,
                  date: formatIsoDate(old.date, 'd MMMM yyyy', i18n.language),
                })}
              </span>{' '}
              · {old.author.short} — {old.change}
              <span className="mt-[2px] block text-[11px] text-dim">
                {t('knowledge.viewingVersionHint')}
              </span>
            </span>
            <Link
              to={location.pathname}
              state={location.state}
              className="shrink-0 rounded-[7px] border border-line px-[10px] py-[5px] text-[11.5px] font-medium text-sub hover:text-text"
            >
              {t('knowledge.toCurrentVersion', { number: current.version })}
            </Link>
          </div>
        )}

        <h2 className="mt-[6px] text-[26px] font-semibold leading-[34px] tracking-[-0.6px] text-text">
          {a.title}
        </h2>
        <div className="mt-[10px] flex items-center text-[12px]">
          <Avatar person={a.author} size={24} />
          <span className="ml-2 font-medium tracking-[-0.1px] text-sub">{a.author.short}</span>
          <span aria-hidden className="mx-2 text-dim">
            ·
          </span>
          <span className="text-dim">
            {old
              ? t('knowledge.versionFrom', { date: shortDate(old.date) })
              : t('knowledge.updated', {
                  date: formatIsoDate(a.updatedAt, 'd MMMM yyyy', i18n.language),
                })}
          </span>
          {!old && reviewedLater && current.reviewed && (
            <span className="ml-2 text-dim">
              ·{' '}
              {t('knowledge.reviewedBy', {
                date: shortDate(current.reviewed.date),
                name: current.reviewed.by.short,
              })}
            </span>
          )}
          <span className="ml-auto flex h-5 items-center rounded-[5px] bg-chip px-5 text-[10px] font-medium text-chip-text">
            {t('knowledge.version', { number: old?.number ?? a.version })}
          </span>
        </div>
        <hr className="mt-5 border-line" />

        <div className="mt-[21px]">
          {a.body.map((block, i) => (
            <Block
              // biome-ignore lint/suspicious/noArrayIndexKey: блоки статьи не переставляются
              key={i}
              block={block}
              first={i === 0}
              changed={!!old && !currentBlocks.has(JSON.stringify(block))}
            />
          ))}
          {a.attachments.length > 0 && (
            <>
              <h3 id={ATTACHMENTS_ID} className={`${heading} scroll-mt-4`}>
                {t('knowledge.attachments')}
              </h3>
              <ul className="mt-2 flex flex-col gap-2">
                {a.attachments.map((f) => (
                  <li
                    key={f.id}
                    className="group flex h-10 items-center rounded-8 border border-line bg-surface pr-[6px] hover:border-info-line"
                  >
                    <button
                      type="button"
                      onClick={() => openAttachment(f)}
                      className="flex h-full min-w-0 flex-1 items-center gap-[9px] pl-[13px] text-left"
                    >
                      <AttachLargeIcon size={17} className="shrink-0 text-faint" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-sub group-hover:text-text">
                        {f.name}
                      </span>
                      <span className="pr-[7px] text-[10.5px] tracking-[0.3px] text-dim">
                        {[f.ext, fileSize(f.size)].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                    <Tooltip content={t('knowledge.download')}>
                      <button
                        type="button"
                        aria-label={`${t('knowledge.download')}: ${f.name}`}
                        onClick={() => openAttachment(f, 'download')}
                        className="flex size-7 shrink-0 items-center justify-center rounded-6 text-faint hover:bg-row-highlight hover:text-text"
                      >
                        <DownloadIcon size={15} />
                      </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </article>

      <SidePanel article={a} toc={toc} active={active} viewing={old?.number ?? a.version} />
    </div>
  );
}

const heading = 'mt-[22px] text-[15px] font-semibold tracking-[-0.2px] text-text';

/** Блок старой версии, который потом изменили, отмечен полосой слева */
function Block({ block, first, changed }: { block: KbBlock; first: boolean; changed: boolean }) {
  const { t } = useTranslation();
  if (!changed) return <BlockContent block={block} first={first} />;
  return (
    <div className="relative">
      <span
        aria-hidden
        className="absolute -left-[13px] bottom-0 top-0 w-[2.5px] rounded-[1.5px] bg-warning"
      />
      <span className="sr-only">{t('knowledge.changedLater')}: </span>
      <BlockContent block={block} first={first} />
    </div>
  );
}

function BlockContent({ block, first }: { block: KbBlock; first: boolean }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className={`text-[13px] leading-[22px] text-sub ${first ? '' : 'mt-2'}`}>{block.text}</p>
      );
    case 'heading':
      return (
        <h3 id={block.id} className={`${heading} scroll-mt-4 ${first ? '!mt-0' : ''}`}>
          {block.text}
        </h3>
      );
    case 'list':
      return (
        <ul className="mt-2 flex flex-col gap-2">
          {block.items.map((item) => (
            <li key={item} className="relative pl-5 text-[13px] leading-[22px] text-sub">
              <span
                aria-hidden
                className="absolute left-1 top-[9px] size-[5px] rounded-full bg-faint"
              />
              {item}
            </li>
          ))}
        </ul>
      );
    case 'note':
      return (
        <aside className="relative mt-4 flex gap-2 overflow-hidden rounded-9 border border-warning-line bg-warning-soft pb-[17px] pl-[15px] pr-5 pt-[11px]">
          <span aria-hidden className="absolute inset-y-0 left-0 w-[2.5px] bg-warning" />
          <ClockIcon size={16} className="mt-[2px] shrink-0 text-warning" />
          <div>
            <p className="text-[12px] font-semibold tracking-[-0.1px] text-warning-strong">
              {block.title}
            </p>
            <p className="mt-[3px] text-[11px] leading-4 text-warning-muted">{block.text}</p>
          </div>
        </aside>
      );
  }
}

const statusChip: Record<TaskStatus, string> = {
  queue: 'bg-chip text-chip-text',
  in_progress: 'bg-info-chip text-info',
  review: 'bg-warning-chip text-warning-strong',
  done: 'bg-success-chip text-success',
};

function SidePanel({
  article: a,
  toc,
  active,
  viewing,
}: {
  article: KbArticle;
  toc: { id: string; text: string }[];
  active: string | null;
  /** Номер открытой версии */
  viewing: number;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const [openDoc, setOpenDoc] = useState<KbRelatedDocument | null>(null);
  const { can } = useCan();
  const shortDate = useShortDate();
  const card = 'flex rounded-8 border border-line bg-surface px-[11px] pt-[11px]';
  // Отступы между блоками в макете разные: 14, 16 и 18 px до разделителя, 17 — после
  const divider = (gap: string) => <hr className={`mx-[6px] border-line ${gap}`} />;

  return (
    <aside
      className={`sticky top-0 max-h-[calc(100vh-138px)] w-[332px] shrink-0 overflow-y-auto rounded-14 border border-line bg-panel px-[13px] pb-6 pt-[23px] ${panelHeight}`}
    >
      {toc.length > 0 && (
        <>
          <h2 className={`${capsTitle} px-[6px]`}>{t('knowledge.toc')}</h2>
          <ul className="mt-[10px]">
            {toc.map((item) => {
              const selected = item.id === active;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    aria-current={selected ? 'location' : undefined}
                    className={`relative flex min-h-[30px] items-center rounded-[7px] px-3 py-[7px] text-[11.5px] tracking-[-0.1px] ${
                      selected
                        ? 'bg-nav-active font-medium text-text'
                        : 'text-sub hover:bg-row-highlight hover:text-text'
                    }`}
                  >
                    {selected && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 h-[14px] w-[2.5px] rounded-[1.5px] bg-info"
                      />
                    )}
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ul>
          {divider('mt-[14px] mb-[15px]')}
        </>
      )}

      {a.relatedTasks.length > 0 && (
        <>
          <h2 className={`${capsTitle} flex items-center gap-2 px-[6px]`}>
            {t('knowledge.relatedTasks')}
            <span className="flex h-4 items-center rounded-[5px] bg-chip px-[5px] text-[9.5px] font-semibold tracking-normal text-sub">
              {a.relatedTasks.length}
            </span>
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {a.relatedTasks.map((task, i) => {
              const content = (
                <>
                  <TasksSmallIcon size={14} className="mt-px shrink-0 text-info" />
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-medium leading-4 tracking-[-0.1px] text-text">
                      {task.title}
                    </span>
                    <span
                      className={`mt-1 inline-flex h-[18px] items-center rounded-[5px] px-[7px] text-[10px] font-medium ${statusChip[task.status]}`}
                    >
                      {t(`tasks.status.${task.status}`)}
                    </span>
                  </span>
                </>
              );
              const className = `${card} gap-[6px] pb-px`;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: у задачи без доступа нет ID
                <li key={`${task.id}-${i}`}>
                  {task.id && can('tasks.view') ? (
                    <Link
                      to={`/tasks?task=${task.id}`}
                      className={`${className} hover:border-info-line`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className={className}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {divider('mt-4 mb-[17px]')}
        </>
      )}

      {a.relatedDocuments.length > 0 && (
        <>
          <h2 className={`${capsTitle} px-[6px]`}>
            {t('knowledge.relatedDocuments', { count: a.relatedDocuments.length })}
          </h2>
          <ul className="mt-[10px] flex flex-col gap-2">
            {a.relatedDocuments.map((doc, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: номера документов в заглушке повторяются
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpenDoc(doc)}
                  className={`${card} w-full gap-[6px] pb-[10px] text-left hover:border-info-line`}
                >
                  <DocSmallIcon size={14} className="mt-[5px] shrink-0 text-faint" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-medium tracking-[-0.1px] text-text">
                      {doc.number}
                    </span>
                    <span className="mt-[2px] block truncate text-[10.5px] text-dim">
                      {doc.title}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {divider('mt-[18px] mb-[17px]')}
        </>
      )}

      <h2 className={`${capsTitle} px-[6px]`}>{t('knowledge.history')}</h2>
      <ol className="mt-[10px] px-[6px]">
        {a.versions.map((v) => {
          const open = v.number === viewing;
          return (
            <li key={v.number} className="border-b border-line py-[2px] last:border-b-0">
              <Link
                to={
                  v.number === a.version
                    ? location.pathname
                    : `${location.pathname}?version=${v.number}`
                }
                state={location.state}
                aria-current={open ? 'page' : undefined}
                className={`-mx-[6px] block rounded-[7px] px-[6px] py-[6px] ${
                  open ? 'bg-nav-active' : 'hover:bg-row-highlight'
                }`}
              >
                <span
                  className={`block text-[11px] font-medium tracking-[-0.1px] ${
                    open ? 'text-text' : 'text-sub'
                  }`}
                >
                  {t('knowledge.versionItem', { number: v.number, date: shortDate(v.date) })}
                  {v.number === a.version && (
                    <span className="font-normal text-dim"> · {t('knowledge.currentVersion')}</span>
                  )}
                </span>
                <span className="mt-[2px] block text-[10.5px] text-dim">
                  {v.author.short} — {v.change}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <DocumentDialog document={openDoc} onClose={() => setOpenDoc(null)} />
    </aside>
  );
}

/** Пункт содержания, до которого дочитали: последний заголовок выше верха прокрутки */
function useActiveHeading(ref: React.RefObject<HTMLElement | null>, ids: string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join('|');

  useEffect(() => {
    const list = key ? key.split('|') : [];
    const scroller = ref.current?.closest('main');
    if (!scroller || list.length === 0) return;
    const update = () => {
      const top = scroller.getBoundingClientRect().top + 80;
      let current = list[0];
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= top) current = id;
      }
      // Дочитали до конца — последний пункт, даже если его заголовок не дошёл до верха
      if (
        scroller.scrollTop > 0 &&
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
      ) {
        current = list[list.length - 1];
      }
      setActive(current);
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    return () => scroller.removeEventListener('scroll', update);
  }, [ref, key]);

  return active;
}
