import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoveTask } from '../api';
import type { Column as BoardColumn, Task } from '../types';
import { Column, type TaskGroup } from './Column';
import { TaskCard } from './TaskCard';

export type Grouping = 'none' | 'project' | 'assignee';

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => a.position - b.position);
}

function groupTasks(
  tasks: Task[],
  grouping: Grouping,
  noAssignee: string,
  noProject: string,
): TaskGroup[] {
  if (grouping === 'none') return [{ key: 'all', label: null, tasks }];
  const map = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const [key, label] =
      grouping === 'project'
        ? [task.project?.id ?? 'none', task.project?.name ?? noProject]
        : [task.assignee?.id ?? 'none', task.assignee?.short ?? noAssignee];
    const group = map.get(key) ?? { key, label, tasks: [] };
    group.tasks.push(task);
    map.set(key, group);
  }
  return [...map.values()];
}

type Order = Record<string, string[]>;

type Props = {
  columns: BoardColumn[];
  tasks: Task[];
  grouping: Grouping;
  canDrag: boolean;
  filtered: boolean;
  onOpen: (id: string) => void;
};

const isFull = (c: BoardColumn) => c.wipLimit !== null && c.count >= c.wipLimit;

const dropAnimation: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

export function Board({ columns, tasks, grouping, canDrag, filtered, onOpen }: Props) {
  const { t } = useTranslation();
  const move = useMoveTask();
  const [active, setActive] = useState<Task | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const [settling, setSettling] = useState<Task[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const baseOrder = useMemo(() => {
    const result: Order = {};
    for (const column of columns) {
      const inColumn = sortTasks(tasks.filter((task) => task.columnId === column.id));
      result[column.id] = groupTasks(inColumn, grouping, '', '').flatMap((g) =>
        g.tasks.map((task) => task.id),
      );
    }
    return result;
  }, [columns, tasks, grouping]);

  const view = order ?? baseOrder;

  useEffect(() => {
    if (settling && settling !== tasks) {
      setSettling(null);
      setOrder(null);
    }
  }, [tasks, settling]);

  useEffect(() => {
    if (!settling) return;
    const timer = setTimeout(() => {
      setSettling(null);
      setOrder(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [settling]);

  useEffect(() => {
    if (!moved) return;
    const timer = setTimeout(() => setMoved(null), 1600);
    return () => clearTimeout(timer);
  }, [moved]);

  const containerOf = (id: UniqueIdentifier | undefined): string | null => {
    if (id === undefined) return null;
    const key = String(id);
    if (key in view) return key;
    return Object.keys(view).find((column) => view[column].includes(key)) ?? null;
  };

  const accepts = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    return Boolean(column) && (columnId === origin || !isFull(column as BoardColumn));
  };

  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    return hits.length ? hits : closestCorners(args);
  };

  const onDragStart = (e: DragStartEvent) => {
    const task = byId.get(String(e.active.id)) ?? null;
    setSettling(null);
    setMessage(null);
    setMoved(null);
    setActive(task);
    setOrigin(task?.columnId ?? null);
    setOrder(baseOrder);
  };

  const onDragOver = ({ active: dragged, over }: DragOverEvent) => {
    if (!over || !order) return;
    const from = containerOf(dragged.id);
    const to = containerOf(over.id);
    if (!from || !to || from === to || !accepts(to)) return;
    setOrder((current) => {
      if (!current) return current;
      const source = current[from].filter((id) => id !== dragged.id);
      const target = [...current[to]];
      const overIndex = target.indexOf(String(over.id));
      const below =
        overIndex >= 0 &&
        dragged.rect.current.translated !== null &&
        dragged.rect.current.translated.top > over.rect.top + over.rect.height / 2;
      const index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : target.length;
      target.splice(index, 0, String(dragged.id));
      return { ...current, [from]: source, [to]: target };
    });
  };

  const finish = () => {
    setActive(null);
    setOrigin(null);
    setOrder(null);
  };

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    const task = byId.get(String(dragged.id));
    const container = containerOf(dragged.id);
    if (!task || !container || !order || !over) {
      finish();
      return;
    }
    let list = order[container];
    const overIndex = list.indexOf(String(over.id));
    const fromIndex = list.indexOf(task.id);
    if (overIndex >= 0 && overIndex !== fromIndex) list = arrayMove(list, fromIndex, overIndex);
    const at = list.indexOf(task.id);
    const beforeId = list[at + 1] ?? null;
    const unchanged =
      container === task.columnId && JSON.stringify(list) === JSON.stringify(baseOrder[container]);
    if (unchanged) {
      finish();
      return;
    }
    const target = columns.find((c) => c.id === container) as BoardColumn;
    setOrder({ ...order, [container]: list });
    setSettling(tasks);
    setActive(null);
    setOrigin(null);
    setMoved(task.id);
    move.mutate(
      { id: task.id, columnId: container, beforeId },
      {
        onSuccess: () => setMessage(t('tasks.moved', { status: target.name })),
        onError: () => {
          setSettling(null);
          setOrder(null);
          setMoved(null);
          setMessage(t('tasks.limitReached', { limit: target.wipLimit ?? 0 }));
        },
      },
    );
  };

  const columnName = (id: UniqueIdentifier) =>
    columns.find((c) => c.id === containerOf(id))?.name ?? '';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
      accessibility={{
        announcements: {
          onDragStart: () => '',
          onDragOver: ({ over }) => (over ? columnName(over.id) : ''),
          onDragEnd: ({ over }) => (over ? t('tasks.moved', { status: columnName(over.id) }) : ''),
          onDragCancel: () => '',
        },
      }}
    >
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
      <div
        className="grid items-start gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(250px, 1fr))`,
        }}
      >
        {columns.map((column) => {
          const ids = view[column.id] ?? [];
          const columnTasks = ids
            .map((id) => byId.get(id))
            .filter((task): task is Task => Boolean(task));
          return (
            <Column
              key={column.id}
              column={column}
              ids={ids}
              total={columnTasks.length}
              groups={groupTasks(
                columnTasks,
                grouping,
                t('tasks.group.noAssignee'),
                t('tasks.group.noProject'),
              )}
              dragActive={active !== null}
              blocked={active !== null && !accepts(column.id)}
              canDrag={canDrag}
              filtered={filtered}
              limitReached={isFull(column)}
              highlighted={moved}
              onOpen={onOpen}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {active ? <TaskCard task={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
