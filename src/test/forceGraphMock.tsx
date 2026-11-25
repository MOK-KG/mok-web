import { forwardRef } from 'react';

/**
 * Заглушка react-force-graph-2d для тестов: в jsdom нет canvas. Узлы — кнопками (клик —
 * onNodeClick), рёбра — списком «откуда → куда», чтобы тесты видели, что пришло в граф.
 */
type Props = {
  graphData: {
    nodes: { id: string; title: string }[];
    links: { source: string; target: string; kind: string }[];
  };
  onNodeClick?: (node: unknown) => void;
};

const ForceGraph2D = forwardRef<unknown, Props>(function ForceGraph2D(
  { graphData, onNodeClick },
  _ref,
) {
  return (
    <div data-testid="force-graph">
      {graphData.nodes.map((n) => (
        <button key={n.id} type="button" data-node={n.id} onClick={() => onNodeClick?.(n)}>
          {n.title}
        </button>
      ))}
      <ul>
        {graphData.links.map((l) => (
          <li key={`${l.source}-${l.target}-${l.kind}`} data-link={l.kind}>
            {`${l.source} → ${l.target}`}
          </li>
        ))}
      </ul>
    </div>
  );
});

export default ForceGraph2D;
