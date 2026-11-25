import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { useTheme } from '@/app/providers/ThemeProvider';
import { themes, toneNames } from '@/shared/config/tokens';
import type { GraphLink, GraphNode, KnowledgeGraphData } from './api';

/**
 * Холст графа (force-directed, как в Obsidian): размер узла — число связей, цвет — раздел,
 * задачи — отдельным цветом, «похожие по смыслу» — пунктиром. Наведение подсвечивает соседей.
 * Грузится лениво (отдельный чанк) — см. LazyKnowledgeGraph.
 */

type SimNode = GraphNode & { x?: number; y?: number };
type SimLink = Omit<GraphLink, 'source' | 'target'> & {
  source: string | SimNode;
  target: string | SimNode;
};

const idOf = (end: string | SimNode) => (typeof end === 'string' ? end : end.id);

export type KnowledgeGraphProps = {
  data: KnowledgeGraphData;
  height: number;
  /** Выделенный узел (текущая статья) */
  focusId?: string;
  /** Узлы, подходящие под поиск, — ярче; остальные приглушены */
  matches?: Set<string> | null;
  /** Подписи всегда (локальный граф) или только при приближении (глобальный) */
  labels?: 'always' | 'zoom';
  onOpen: (node: GraphNode) => void;
};

export default function KnowledgeGraph({
  data,
  height,
  focusId,
  matches,
  labels = 'zoom',
  onOpen,
}: KnowledgeGraphProps) {
  const { theme } = useTheme();
  const colors = themes[theme];
  const box = useRef<HTMLDivElement>(null);
  const graph = useRef<ForceGraphMethods | undefined>(undefined);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  // Библиотека дописывает в узлы и рёбра координаты — даём ей копию, кэш запроса не трогаем
  const sim = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })) as SimNode[],
      links: data.links.map((l) => ({ ...l })) as SimLink[],
    }),
    [data],
  );

  const sectionColor = useMemo(() => {
    const ids = [...new Set(data.nodes.map((n) => n.sectionId ?? ''))].sort();
    return (id: string | null | undefined) =>
      colors[`tone-${toneNames[Math.max(0, ids.indexOf(id ?? '')) % toneNames.length]}`];
  }, [data.nodes, colors]);

  const neighbours = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of data.links) {
      for (const [a, b] of [
        [l.source, l.target],
        [l.target, l.source],
      ]) {
        if (!map.has(a)) map.set(a, new Set());
        map.get(a)?.add(b);
      }
    }
    return map;
  }, [data.links]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth || 320);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const lit = (id: string) => {
    if (hover) return id === hover || Boolean(neighbours.get(hover)?.has(id));
    if (matches) return matches.has(id);
    return true;
  };

  return (
    <div ref={box} style={{ height }} className="w-full overflow-hidden">
      {width > 0 && (
        <ForceGraph2D
          ref={graph}
          graphData={sim}
          width={width}
          height={height}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={120}
          onEngineStop={() => graph.current?.zoomToFit(400, 40)}
          nodeRelSize={4}
          nodeVal={(n) => 1 + (n as SimNode).degree}
          nodeLabel={(n) => (n as SimNode).title}
          onNodeHover={(n) => setHover(n ? (n as SimNode).id : null)}
          onNodeClick={(n) => onOpen(n as SimNode)}
          linkColor={(l) => {
            const link = l as SimLink;
            const on = !hover || idOf(link.source) === hover || idOf(link.target) === hover;
            if (!on) return `${colors.line}55`;
            return link.kind === 'task' ? colors['tone-orange'] : colors.faint;
          }}
          linkLineDash={(l) => ((l as SimLink).kind === 'suggested' ? [3, 3] : null)}
          linkWidth={(l) => ((l as SimLink).kind === 'suggested' ? 0.6 : 1)}
          linkDirectionalArrowLength={(l) => ((l as SimLink).kind === 'link' ? 3 : 0)}
          linkDirectionalArrowRelPos={1}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(n, ctx, scale) => {
            const node = n as SimNode;
            const r = Math.sqrt(1 + node.degree) * 4;
            const on = lit(node.id);
            ctx.globalAlpha = on ? 1 : 0.18;
            ctx.beginPath();
            if (node.kind === 'task') {
              ctx.rect((node.x ?? 0) - r * 0.8, (node.y ?? 0) - r * 0.8, r * 1.6, r * 1.6);
              ctx.fillStyle = colors['tone-orange'];
            } else {
              ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
              ctx.fillStyle = node.personal ? colors.info : sectionColor(node.sectionId);
            }
            ctx.fill();
            if (node.id === focusId) {
              ctx.lineWidth = 2 / scale;
              ctx.strokeStyle = colors.text;
              ctx.stroke();
            }
            if (labels === 'always' || scale > 1.4 || node.id === hover || node.id === focusId) {
              const size = 11 / scale;
              ctx.font = `${size}px Inter, system-ui, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = colors.sub;
              const text = node.title.length > 42 ? `${node.title.slice(0, 40)}…` : node.title;
              ctx.fillText(text, node.x ?? 0, (node.y ?? 0) + r + 2 / scale);
            }
            ctx.globalAlpha = 1;
          }}
          nodePointerAreaPaint={(n, color, ctx) => {
            const node = n as SimNode;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, Math.sqrt(1 + node.degree) * 4 + 2, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />
      )}
    </div>
  );
}
