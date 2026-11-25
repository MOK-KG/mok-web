import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useCan } from '@/features/auth';
import { useTaskLink } from '@/features/tasks/TaskOverlay';
import { errorText } from '@/shared/api/feedback';
import { themes, toneNames } from '@/shared/config/tokens';
import { ChevronLeftIcon, SearchIcon } from '@/shared/ui/icons';
import { type GraphNode, type KnowledgeGraphData, useKnowledgeGraph } from './api';

const KnowledgeGraph = lazy(() => import('./KnowledgeGraph'));

/** Открыть узел: статья — её страница, задача — карточка задачи поверх графа */
export function useOpenGraphNode() {
  const navigate = useNavigate();
  const taskLink = useTaskLink();
  return (node: GraphNode) => {
    if (node.kind === 'article' && node.slug) navigate(`/knowledge/${node.slug}`);
    else if (node.taskId) navigate(taskLink(node.taskId));
  };
}

/**
 * Граф базы знаний (/knowledge/graph), как в Obsidian: все видимые статьи и ссылки между ними.
 * Фильтр по разделам, задачи и похожие по смыслу статьи (пунктир), поиск подсвечивает узлы.
 */
export function GraphPage() {
  const { t } = useTranslation();
  const { can } = useCan();
  const { theme } = useTheme();
  const [tasks, setTasks] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const graph = useKnowledgeGraph({ tasks: tasks && can('tasks.view'), suggested });
  const open = useOpenGraphNode();

  const sections = useMemo(() => {
    const seen = new Map<string, string>();
    for (const n of graph.data?.nodes ?? []) {
      if (n.kind === 'article')
        seen.set(n.sectionId ?? '', n.sectionName || t('knowledge.noSection'));
    }
    const ids = [...seen.keys()].sort();
    return ids.map((id) => ({
      id,
      name: seen.get(id) ?? '',
      color: themes[theme][`tone-${toneNames[ids.indexOf(id) % toneNames.length]}`],
    }));
  }, [graph.data, theme, t]);

  // Скрытые разделы убирают свои статьи; задача остаётся, пока видна её статья
  const shown: KnowledgeGraphData | null = useMemo(() => {
    if (!graph.data) return null;
    const articles = graph.data.nodes.filter(
      (n) => n.kind === 'article' && !hidden.has(n.sectionId ?? ''),
    );
    const ids = new Set(articles.map((n) => n.id));
    const links = graph.data.links.filter(
      (l) => ids.has(l.target) && (ids.has(l.source) || l.source.startsWith('task:')),
    );
    const taskIds = new Set(links.filter((l) => l.kind === 'task').map((l) => l.source));
    const nodes = [
      ...articles,
      ...graph.data.nodes.filter((n) => n.kind === 'task' && taskIds.has(n.id)),
    ];
    return { nodes, links };
  }, [graph.data, hidden]);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle && shown
        ? new Set(
            shown.nodes.filter((n) => n.title.toLowerCase().includes(needle)).map((n) => n.id),
          )
        : null,
    [needle, shown],
  );

  const articles = shown?.nodes.filter((n) => n.kind === 'article').length ?? 0;
  const links = shown?.links.filter((l) => l.kind === 'link').length ?? 0;
  usePageSubtitle(shown ? t('knowledge.graph.counts', { articles, links }) : undefined);

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chip = (on: boolean) =>
    `flex h-8 items-center gap-[7px] rounded-9 border px-3 text-[12px] ${
      on
        ? 'border-transparent bg-control-active font-medium text-text'
        : 'border-line text-faint hover:text-text'
    }`;

  return (
    <div className="flex h-full min-h-[600px] flex-col gap-3 leading-[normal]">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/knowledge"
          className="flex items-center gap-[6px] text-[12.5px] text-sub hover:text-text"
        >
          <ChevronLeftIcon size={16} />
          {t('knowledge.title')}
        </Link>
        <label className="relative ml-auto flex h-8 w-[240px] items-center">
          <SearchIcon size={16} className="pointer-events-none absolute left-[10px] text-dim" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('knowledge.graph.search')}
            aria-label={t('knowledge.graph.search')}
            className="h-full w-full rounded-9 border border-line bg-column pl-[34px] pr-[10px] text-[12px] text-text outline-none placeholder:text-dim focus:border-info"
          />
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-[6px]">
        <legend className="sr-only">{t('knowledge.graph.filters')}</legend>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={!hidden.has(s.id)}
            onClick={() => toggle(s.id)}
            className={chip(!hidden.has(s.id))}
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: hidden.has(s.id) ? undefined : s.color }}
            />
            {s.name}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        {can('tasks.view') && (
          <button
            type="button"
            aria-pressed={tasks}
            onClick={() => setTasks((v) => !v)}
            className={chip(tasks)}
          >
            <span aria-hidden className="size-2 bg-tone-orange" />
            {t('knowledge.graph.tasks')}
          </button>
        )}
        <button
          type="button"
          aria-pressed={suggested}
          onClick={() => setSuggested((v) => !v)}
          className={chip(suggested)}
        >
          <span aria-hidden className="w-4 border-t border-dashed border-faint" />
          {t('knowledge.graph.suggested')}
        </button>
      </fieldset>
      <section
        aria-label={t('knowledge.graph.title')}
        className="relative min-h-0 flex-1 overflow-hidden rounded-14 border border-line bg-panel"
      >
        {graph.isError ? (
          <p className="mt-16 text-center text-[12.5px] text-dim">{errorText(graph.error, t)}</p>
        ) : shown && shown.nodes.length === 0 ? (
          <p className="mt-16 text-center text-[12.5px] text-dim">{t('knowledge.graph.empty')}</p>
        ) : (
          shown && (
            <Suspense fallback={null}>
              <KnowledgeGraph data={shown} height={640} matches={matches} onOpen={open} />
            </Suspense>
          )
        )}
        <p className="pointer-events-none absolute bottom-3 left-4 text-[10.5px] text-dim">
          {t('knowledge.graph.hint')}
        </p>
      </section>
    </div>
  );
}

/** Локальный граф статьи (соседи на 1–2 шага) и обратные ссылки — в боковой панели статьи */
export function LocalGraph({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { can } = useCan();
  const [depth, setDepth] = useState<1 | 2>(1);
  const graph = useKnowledgeGraph({ article: slug, depth, tasks: can('tasks.view') });
  const open = useOpenGraphNode();
  const data = graph.data;
  const me = `doc:${slug}`;
  const backlinks = (data?.nodes ?? []).filter((n) =>
    data?.links.some((l) => l.kind === 'link' && l.target === me && l.source === n.id),
  );
  if (!data || data.nodes.length <= 1) {
    return data ? (
      <p className="px-[6px] text-[11.5px] text-dim">{t('knowledge.graph.noLinks')}</p>
    ) : null;
  }
  return (
    <div>
      <div className="flex items-center gap-1 px-[6px]">
        {([1, 2] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={depth === d}
            onClick={() => setDepth(d)}
            className={`h-6 rounded-6 px-2 text-[11px] ${
              depth === d ? 'bg-control-active text-text' : 'text-faint hover:text-text'
            }`}
          >
            {t('knowledge.graph.depth', { count: d })}
          </button>
        ))}
        <Link to="/knowledge/graph" className="ml-auto text-[11px] text-info hover:underline">
          {t('knowledge.graph.openGlobal')}
        </Link>
      </div>
      <div className="mt-2 rounded-8 border border-line bg-surface">
        <Suspense fallback={<div style={{ height: 220 }} />}>
          <KnowledgeGraph data={data} height={220} focusId={me} labels="always" onOpen={open} />
        </Suspense>
      </div>
      <h3 className="mt-3 px-[6px] text-[10.5px] font-semibold uppercase tracking-[1px] text-dim">
        {t('knowledge.graph.backlinks')} {backlinks.length}
      </h3>
      {backlinks.length === 0 ? (
        <p className="px-[6px] pt-1 text-[11.5px] text-dim">{t('knowledge.graph.noBacklinks')}</p>
      ) : (
        <ul className="mt-1">
          {backlinks.map((n) => (
            <li key={n.id}>
              <Link
                to={`/knowledge/${n.slug}`}
                className="block truncate rounded-6 px-[6px] py-1 text-[12px] text-sub hover:bg-row-highlight hover:text-text"
              >
                {n.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
