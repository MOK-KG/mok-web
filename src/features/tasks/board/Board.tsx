import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoveTask } from '../api';
import { type Task, type TaskStatus, taskStatuses, WIP_LIMIT } from '../types';
import { Column, type TaskGroup } from './Column';
import { TaskCard } from './TaskCard';

export type Grouping = 'none' | 'project' | 'assignee';

/** Порядок: ближайший срок сверху, без срока — в конце; готовые — недавние сверху */
function sortTasks(tasks: Task[], status: TaskStatus) {
  const key = (t: Task) => t.due ?? '9999-12-31';
  const sorted = [...tasks].sort((a, b) => key(a).localeCompare(key(b)));
  return status === 'done' ? sorted.reverse() : sorted;
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

type Props = {
  tasks: Task[];
  grouping: Grouping;
  canDrag: boolean;
  /** Сколько задач «В работе» всего, без фильтров — лимит считается по всем */
  inProgressAll: number;
  /** Включены фильтр или поиск */
  filtered: boolean;
  onOpen: (id: string) => void;
};

/** Канбан-доска: 4 колонки, перетаскивание карточек между ними */
export function Board({ tasks, grouping, canDrag, inProgressAll, filtered, onOpen }: Props) {
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

  const byStatus = useMemo(() => {
    const result = {} as Record<TaskStatus, Task[]>;
    for (const status of taskStatuses) {
      result[status] = sortTasks(
        tasks.filter((task) => task.status === status),
        status,
      );
    }
    return result;
  }, [tasks]);

  const inProgressFull = inProgressAll >= WIP_LIMIT;

  const onDragStart = (e: DragStartEvent) => {
    setMessage(null);
    setActive((e.active.data.current?.task as Task) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const task = e.active.data.current?.task as Task | undefined;
    const target = e.over?.id as TaskStatus | undefined;
    if (!task || !target || task.status === target) return;
    move.mutate(
      { id: task.id, status: target },
      {
        onSuccess: () => setMessage(t('tasks.moved', { status: t(`tasks.status.${target}`) })),
        onError: () => setMessage(t('tasks.limitReached', { limit: WIP_LIMIT })),
      },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements: {
          onDragStart: () => '',
          onDragOver: ({ over }) => (over ? t(`tasks.status.${over.id as TaskStatus}`) : ''),
          onDragEnd: ({ over }) =>
            over ? t('tasks.moved', { status: t(`tasks.status.${over.id as TaskStatus}`) }) : '',
          onDragCancel: () => '',
        },
      }}
    >
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
      <div className="grid min-w-[1040px] grid-cols-4 items-start gap-3">
        {taskStatuses.map((status) => (
          <Column
            key={status}
            status={status}
            total={byStatus[status].length}
            groups={groupTasks(
              byStatus[status],
              grouping,
              t('tasks.group.noAssignee'),
              t('tasks.group.noProject'),
            )}
            dragActive={active !== null}
            blocked={status === 'in_progress' && inProgressFull && active?.status !== 'in_progress'}
            canDrag={canDrag}
            filtered={filtered}
            limitReached={inProgressFull}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>{active ? <TaskCard task={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
