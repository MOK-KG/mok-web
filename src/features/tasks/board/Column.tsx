import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightIcon } from '@/shared/ui/icons';
import { type Task, type TaskStatus, WIP_LIMIT } from '../types';
import { statusDot, visibleByStatus } from '../ui';
import { TaskCard } from './TaskCard';

export type TaskGroup = { key: string; label: string | null; tasks: Task[] };

type Props = {
  status: TaskStatus;
  groups: TaskGroup[];
  /** Сколько задач в колонке всего (для счётчика «4 из 6») */
  total: number;
  /** Сейчас что-то перетаскивают */
  dragActive: boolean;
  /** Колонка не принимает карточку (лимит «В работе») */
  blocked: boolean;
  canDrag: boolean;
  /** Включены фильтр или поиск: счётчик показывает видимые задачи */
  filtered: boolean;
  /** Лимит «В работе» исчерпан (по всем задачам) */
  limitReached: boolean;
  onOpen: (id: string) => void;
};

/** Колонка канбана (макет Figma: col/*) */
export function Column({
  status,
  groups,
  total,
  dragActive,
  blocked,
  canDrag,
  filtered,
  limitReached,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: blocked });

  // Видимые карточки: первые N по всем группам, пока не нажали «Показать все»
  const limit = expanded ? Number.POSITIVE_INFINITY : visibleByStatus[status];
  let left = limit;
  const visibleGroups = groups
    .map((g) => {
      const tasks = g.tasks.slice(0, Math.max(0, left));
      left -= tasks.length;
      return { ...g, tasks };
    })
    .filter((g) => g.tasks.length > 0);
  const shown = visibleGroups.reduce((n, g) => n + g.tasks.length, 0);
  const title = t(`tasks.status.${status}`);

  const counter =
    status === 'in_progress' && !filtered
      ? `${total} / ${WIP_LIMIT}`
      : shown < total
        ? t('tasks.shownOf', { shown, total })
        : String(total);

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={`flex min-w-0 flex-col rounded-14 border bg-column transition-colors ${
        isOver ? 'border-info' : 'border-line'
      }`}
    >
      <header className="flex h-10 shrink-0 items-center gap-[6px] border-b border-line px-[13px]">
        <span aria-hidden className={`size-[7px] rounded-full ${statusDot[status]}`} />
        <h2 className="text-[12.5px] font-semibold tracking-[-0.1px] text-text">{title}</h2>
        <span className="ml-[3px] rounded-[9px] bg-chip px-[7px] py-[2px] text-[10.5px] font-medium text-sub">
          {counter}
        </span>
        {status === 'in_progress' && (
          <span
            className={`text-[9.5px] tracking-[0.2px] ${limitReached ? 'text-danger' : 'text-dim'}`}
          >
            {t('tasks.limit')}
          </span>
        )}
      </header>

      <div className="flex flex-col gap-[10px] p-[9px]">
        {visibleGroups.map((group) => (
          <div key={group.key} className="flex flex-col gap-[10px]">
            {group.label && (
              <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-dim">
                {group.label}
              </p>
            )}
            {group.tasks.map((task) => (
              <TaskCard key={task.id} task={task} draggable={canDrag} onOpen={onOpen} />
            ))}
          </div>
        ))}

        {total === 0 && !dragActive && (
          <p className="py-4 text-center text-[11.5px] text-dim">{t('tasks.empty')}</p>
        )}

        {shown < total && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex h-8 items-center justify-between rounded-9 text-[11.5px] font-medium text-info hover:underline"
          >
            {t('tasks.showAll', { count: total })}
            <ArrowRightIcon size={14} />
          </button>
        )}

        {canDrag && (
          <div
            className={`flex h-10 items-center justify-center rounded-9 border border-dashed text-[11px] transition-colors ${
              blocked && dragActive
                ? 'border-danger-line text-danger'
                : isOver
                  ? 'border-info text-info'
                  : 'border-line text-dim'
            }`}
          >
            {blocked && dragActive
              ? t('tasks.limitReached', { limit: WIP_LIMIT })
              : t('tasks.dropHere')}
          </div>
        )}
      </div>
    </section>
  );
}
