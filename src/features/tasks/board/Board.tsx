import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoveTask } from '../api';
import type { Column as BoardColumn, Task } from '../types';
import { Column, type TaskGroup } from './Column';
import { TaskCard } from './TaskCard';

export type Grouping = 'none' | 'project' | 'assignee';

/** Порядок в колонке — как его сохранил бэкенд (куда карточку перетащили) */
function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => a.position - b.position);
}

/** Префикс места для броска на карточку: «встать перед этой задачей» */
export const CARD_DROP = 'card:';

/**
 * Куда бросили: сначала карточка под указателем (встать перед ней), затем колонка
 * (в конец). С клавиатуры указателя нет — ближайшее место по центру
 */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const cards = hits.filter((h) => String(h.id).startsWith(CARD_DROP));
  if (cards.length) return cards;
  if (hits.length) return hits;
  return closestCenter(args);
};

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

type Props = {
  /** Колонки доски с бэкенда: порядок, этап, лимит и число задач (без фильтров) */
  columns: BoardColumn[];
  tasks: Task[];
  grouping: Grouping;
  canDrag: boolean;
  /** Включены фильтр или поиск */
  filtered: boolean;
  onOpen: (id: string) => void;
};

/** Колонка заполнена: лимит считается по всем её задачам, без фильтров */
const isFull = (c: BoardColumn) => c.wipLimit !== null && c.count >= c.wipLimit;

/** Канбан-доска: колонки с бэкенда, перетаскивание карточек между ними */
export function Board({ columns, tasks, grouping, canDrag, filtered, onOpen }: Props) {
  const { t } = useTranslation();
  const move = useMoveTask();
  const [active, setActive] = useState<Task | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Перетаскивание с клавиатуры — пробелом; Enter открывает карточку
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const byColumn = useMemo(() => {
    const result = new Map<string, Task[]>();
    for (const column of columns) {
      result.set(column.id, sortTasks(tasks.filter((task) => task.columnId === column.id)));
    }
    return result;
  }, [columns, tasks]);

  /** Колонка и задача, перед которой встать, по месту броска */
  const dropTarget = (overId: unknown) => {
    const id = String(overId ?? '');
    if (id.startsWith(CARD_DROP)) {
      const before = tasks.find((t) => t.id === id.slice(CARD_DROP.length));
      const column = columns.find((c) => c.id === before?.columnId);
      return column && before ? { column, beforeId: before.id } : null;
    }
    const column = columns.find((c) => c.id === id);
    return column ? { column, beforeId: null } : null;
  };
  const columnName = (id: unknown) => dropTarget(id)?.column.name ?? '';

  const onDragStart = (e: DragStartEvent) => {
    setMessage(null);
    setActive((e.active.data.current?.task as Task) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const task = e.active.data.current?.task as Task | undefined;
    const drop = dropTarget(e.over?.id);
    if (!task || !drop || drop.beforeId === task.id) return;
    const target = drop.column;
    // Та же колонка и бросили не на карточку — порядок не меняется
    if (task.columnId === target.id && !drop.beforeId) return;
    if (task.columnId !== target.id && isFull(target)) {
      setMessage(t('tasks.limitReached', { limit: target.wipLimit ?? 0 }));
      return;
    }
    move.mutate(
      { id: task.id, columnId: target.id, beforeId: drop.beforeId },
      {
        onSuccess: () => setMessage(t('tasks.moved', { status: target.name })),
        onError: () => setMessage(t('tasks.limitReached', { limit: target.wipLimit ?? 0 })),
      },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
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
        // Колонок столько, сколько настроено на бэкенде; ширина колонки — не меньше 250px
        style={{
          gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(250px, 1fr))`,
        }}
      >
        {columns.map((column) => {
          const columnTasks = byColumn.get(column.id) ?? [];
          return (
            <Column
              key={column.id}
              column={column}
              total={columnTasks.length}
              groups={groupTasks(
                columnTasks,
                grouping,
                t('tasks.group.noAssignee'),
                t('tasks.group.noProject'),
              )}
              dragActive={active !== null}
              blocked={isFull(column) && active?.columnId !== column.id}
              canDrag={canDrag}
              filtered={filtered}
              limitReached={isFull(column)}
              onOpen={onOpen}
            />
          );
        })}
      </div>
      <DragOverlay>{active ? <TaskCard task={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
