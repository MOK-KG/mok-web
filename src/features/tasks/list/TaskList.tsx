import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentPersonId } from '@/features/auth';
import { initials } from '@/shared/lib/text';
import {
  BoltSmallIcon,
  CommentIcon,
  MailSmallIcon,
  PaperclipIcon,
  PlaneIcon,
  SubtasksIcon,
} from '@/shared/ui/icons';
import { PersonPhoto } from '@/shared/ui/PersonPhoto';
import { DueChips } from '../board/TaskCard';
import { urgencyOf } from '../deadline';
import { matchesQuick, type QuickFilter, quickFilters, sortForList } from '../list';
import type { Column, Task } from '../types';
import { statusDot, toneClasses } from '../ui';

const stripeOf = (task: Task) => {
  if (task.status === 'done') return null;
  const { urgency } = urgencyOf(task);
  if (urgency === 'overdue') return 'bg-brand-red';
  if (task.escalationHours !== null || task.deputy !== null || urgency === 'soon')
    return 'bg-warning';
  return urgency === 'week' ? 'bg-info' : null;
};

function TaskRow({
  task,
  columnName,
  onOpen,
}: {
  task: Task;
  columnName: string;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const stripe = stripeOf(task);
  return (
    <li className="relative border-t border-line first:border-t-0">
      {stripe && <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${stripe}`} />}
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className="flex w-full flex-col gap-[7px] px-4 py-3 text-left hover:bg-row-highlight focus-visible:bg-row-highlight focus-visible:outline-none md:flex-row md:items-center md:gap-4"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <span className="flex items-center gap-[6px] text-[10.5px] font-medium text-faint">
            {task.project && (
              <>
                <span
                  aria-hidden
                  className={`size-[6px] rounded-full ${toneClasses[task.project.tone].dot}`}
                />
                <span className="truncate">{task.project.name}</span>
                <span aria-hidden className="text-dim">
                  ·
                </span>
              </>
            )}
            <span className="truncate text-dim">{task.code}</span>
          </span>
          <span className="text-[13.5px] font-medium leading-[19px] text-text">{task.title}</span>
          {task.escalationHours !== null && task.status !== 'done' && (
            <span className="flex items-center gap-[5px] text-[11px] font-medium text-warning-text">
              <BoltSmallIcon size={13} />
              {t('tasks.escalation', { hours: task.escalationHours })}
            </span>
          )}
          {task.deputy && task.status !== 'done' && (
            <span className="flex items-center gap-[5px] text-[11px] font-medium text-info">
              <PlaneIcon size={13} />
              {t('tasks.deputy', { name: task.deputy.short })}
            </span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-[6px] md:w-[300px] md:justify-end">
          <span className="inline-flex h-5 items-center gap-[5px] rounded-[5px] bg-chip px-[7px] text-[10.5px] font-medium text-chip-text">
            <span aria-hidden className={`size-[6px] rounded-full ${statusDot[task.status]}`} />
            {columnName}
          </span>
          <DueChips task={task} />
          <span className="ml-auto flex items-center gap-[6px] text-faint md:ml-2">
            {task.fromEmail && <MailSmallIcon size={13} aria-label={t('tasks.fromEmail')} />}
            {task.subtasks > 0 && (
              <span className="flex items-center gap-[3px] text-[10.5px]">
                <SubtasksIcon size={12} />
                {task.subtasks}
              </span>
            )}
            {task.comments > 0 && (
              <span className="flex items-center gap-[3px] text-[10.5px]">
                <CommentIcon size={12} />
                {task.comments}
              </span>
            )}
            {task.attachments > 0 && (
              <span className="flex items-center gap-[3px] text-[10.5px]">
                <PaperclipIcon size={12} />
                {task.attachments}
              </span>
            )}
            {task.assignee && (
              <span
                title={task.assignee.name}
                className={`relative flex size-6 items-center justify-center overflow-hidden rounded-full text-[9px] font-semibold ${toneClasses[task.assignee.tone].bg} ${toneClasses[task.assignee.tone].text}`}
              >
                {initials(task.assignee.name)}
                <PersonPhoto id={task.assignee.id} />
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

export function TaskList({
  tasks,
  columns,
  onOpen,
}: {
  tasks: Task[];
  columns: Column[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const me = useCurrentPersonId();
  const [quick, setQuick] = useState<QuickFilter>('all');
  const columnName = (task: Task) =>
    columns.find((c) => c.id === task.columnId)?.name ?? t(`tasks.status.${task.status}`);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        quickFilters.map((q) => [
          q,
          tasks.filter((task) => matchesQuick(task, q, undefined, me)).length,
        ]),
      ) as Record<QuickFilter, number>,
    [tasks, me],
  );
  const shown = useMemo(
    () => sortForList(tasks.filter((task) => matchesQuick(task, quick, undefined, me))),
    [tasks, quick, me],
  );

  return (
    <section aria-label={t('tasks.view.list')} className="flex flex-col gap-[10px]">
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {quickFilters.map((q) => (
          <button
            key={q}
            type="button"
            role="tab"
            aria-selected={q === quick}
            onClick={() => setQuick(q)}
            className={`flex h-8 shrink-0 items-center gap-[6px] rounded-full border px-3 text-[12px] font-medium ${
              q === quick
                ? 'border-info bg-popover-active text-text'
                : 'border-line bg-panel text-sub hover:text-text'
            }`}
          >
            {t(`tasks.quick.${q}`)}
            <span className="text-[11px] text-dim">{counts[q]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="rounded-14 border border-line bg-panel px-4 py-6 text-center text-[12.5px] text-dim">
          {t('tasks.empty')}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-14 border border-line bg-panel">
          {shown.map((task) => (
            <TaskRow key={task.id} task={task} columnName={columnName(task)} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}
