import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Граф базы знаний (mok-backend, apps/knowledge/graph.py, /api/knowledge/graph): статьи —
 * узлы, ссылки из текста — рёбра; по желанию — задачи и «похожие по смыслу» (пунктир).
 * Только то, что видно сотруднику. article — локальный граф статьи на depth шагов.
 */

export type GraphNode = {
  /** doc:<slug> или task:<uuid> */
  id: string;
  kind: 'article' | 'task';
  title: string;
  slug?: string;
  sectionId?: string | null;
  sectionName?: string;
  personal?: boolean;
  taskId?: string;
  stage?: string;
  /** Число связей — размер узла */
  degree: number;
};

export type GraphLink = {
  source: string;
  target: string;
  kind: 'link' | 'task' | 'suggested';
  score?: number;
};

export type KnowledgeGraphData = { nodes: GraphNode[]; links: GraphLink[] };

export type GraphQuery = {
  article?: string;
  depth?: number;
  tasks?: boolean;
  suggested?: boolean;
};

export const fetchGraph = (q: GraphQuery = {}) => {
  const params = new URLSearchParams();
  if (q.article) params.set('article', q.article);
  if (q.depth) params.set('depth', String(q.depth));
  if (q.tasks) params.set('tasks', '1');
  if (q.suggested) params.set('suggested', '1');
  const query = params.toString();
  return api.get<KnowledgeGraphData>(`/knowledge/graph${query ? `?${query}` : ''}`);
};

export const useKnowledgeGraph = (q: GraphQuery, enabled = true) =>
  useQuery({ queryKey: ['knowledge', 'graph', q], queryFn: () => fetchGraph(q), enabled });
