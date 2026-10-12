import { useDraggable } from '@dnd-kit/core';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatIsoDate } from '@/shared/lib/date';
import { initials } from '@/shared/lib/text';
import {
  BoltSmallIcon,
  CommentIcon,
  MailSmallIcon,
  PaperclipIcon,
  PlaneIcon,
  RescheduleIcon,
  SubtasksIcon,
} from '@/shared/ui/icons';
import { type Urgency, urgencyOf } from '../deadline';
import type { Task } from '../types';
import { toneClasses } from '../ui';

type Drag = ReturnType<typeof useDraggable>;

const shortDate = (due: string, lang: string) => formatIsoDate(due, 'd MMM', lang).replace('.', '');

const stripe: Record<Urgency | 'signal', string | null> = {
  overdue: 'bg-brand-red',
  soon: 'bg-warning',
  signal: 'bg-warning',
  week: 'bg-info',
  later: null,
  none: null,
};

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-[5px] px-[7px] text-[10.5px] font-medium tracking-[0.1px] ${className}`}
    >
      {children}
    </span>
  );
}

function DueChips({ task }: { task: Task }) {
  const { t, i18n } = useTranslation();
  if (task.status === 'done') {
    return <Chip className="bg-tone-green-bg text-tone-green">{t('tasks.doneChip')}</Chip>;
  }
  const { urgency, days } = urgencyOf(task);
  if (!task.due) return <Chip className="bg-muted-chip text-dim">{t('tasks.noDue')}</Chip>;
  const date = shortDate(task.due, i18n.language);
  switch (urgency) {
    case 'overdue':
      return (
        <>
          <Chip className="bg-danger-chip text-danger">{t('tasks.overdue', { count: days })}</Chip>
          <Chip className="bg-danger-chip text-danger">{date}</Chip>
        </>
      );
    case 'soon':
      return (
        <Chip className="bg-warning-chip text-warning-text">
          {days === 0 ? `${date} · ${t('tasks.today')}` : t('tasks.inDays', { date, count: days })}
        </Chip>
      );
    case 'week':
      return <Chip className="bg-info-chip text-info-text">{date}</Chip>;
    default:
      return <Chip className="bg-chip text-chip-text">{date}</Chip>;
  }
}

function Meta({
  Icon,
  count,
  label,
}: {
  Icon: ComponentType<{ size?: number }>;
  count?: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-[3px] text-faint" title={label}>
      <Icon size={12} />
      {count !== undefined && <span className="text-[10px]">{count}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}

type Props = {
  task: Task;
  /** Открыть карточку задачи (клик или Enter) */
  onOpen?: (id: string) => void;
  draggable?: boolean;
  /** Карточка в слое перетаскивания */
  overlay?: boolean;
};

/** Мини-карточка задачи на доске (макет Figma: card/*) */
export function TaskCard({ task, onOpen, draggable = false, overlay = false }: Props) {
  const drag = useDraggable({ id: task.id, data: { task }, disabled: !draggable || overlay });
  return (
    <CardView
      task={task}
      overlay={overlay}
      dragging={drag.isDragging}
      setRef={drag.setNodeRef}
      attributes={draggable ? drag.attributes : undefined}
      listeners={draggable ? drag.listeners : undefined}
      onOpen={overlay ? undefined : onOpen}
    />
  );
}

function CardView({
  task,
  overlay,
  dragging,
  setRef,
  attributes,
  listeners,
  onOpen,
}: {
  task: Task;
  onOpen?: (id: string) => void;
  overlay: boolean;
  dragging: boolean;
  setRef: (el: HTMLElement | null) => void;
  attributes?: Drag['attributes'];
  listeners?: Drag['listeners'];
}) {
  const { t } = useTranslation();
  const { urgency } = urgencyOf(task);
  const signal = task.escalationHours !== null || task.deputy !== null;
  const stripeClass =
    task.status === 'done' ? null : stripe[signal && urgency !== 'overdue' ? 'signal' : urgency];

  return (
    <article
      ref={setRef}
      aria-label={task.title}
      {...attributes}
      {...listeners}
      className={`relative overflow-hidden rounded-[10px] border border-line bg-card px-[13px] pb-3 pt-[10px] shadow-[0_1px_3px_rgba(10,22,40,0.05)] outline-none focus-visible:ring-2 focus-visible:ring-info ${
        listeners ? 'cursor-grab active:cursor-grabbing' : ''
      } ${dragging ? 'opacity-40' : ''} ${overlay ? 'rotate-[1.5deg] shadow-[0_12px_32px_rgba(0,0,0,0.35)]' : ''}`}
    >
      {stripeClass && (
        <span aria-hidden className={`absolute inset-y-0 left-0 w-[2.5px] ${stripeClass}`} />
      )}
      {task.project && (
        <p className="flex items-center gap-[5px] text-[10px] font-medium tracking-[0.2px] text-faint">
          <span
            aria-hidden
            className={`size-[6px] rounded-full ${toneClasses[task.project.tone].dot}`}
          />
          {task.project.name}
        </p>
      )}
      <h3 className="mt-[5px] text-[12.5px] font-medium leading-[17px] text-text">
        {onOpen ? (
          // Кнопка растянута на всю карточку: клик и Enter открывают задачу,
          // перетаскивание остаётся на самой карточке
          <button
            type="button"
            onClick={() => onOpen(task.id)}
            className="text-left outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-2 focus-visible:after:ring-info"
          >
            {task.title}
          </button>
        ) : (
          task.title
        )}
      </h3>
      <div className="mt-[9px] flex flex-wrap gap-[6px]">
        <DueChips task={task} />
      </div>

      {task.escalationHours !== null && task.status !== 'done' && (
        <p className="mt-2 flex gap-[5px] text-[10.5px] font-medium leading-[14px] tracking-[0.1px] text-warning-text">
          <BoltSmallIcon size={13} className="mt-[1px] shrink-0" />
          {t('tasks.escalation', { hours: task.escalationHours })}
        </p>
      )}
      {task.deputy && task.status !== 'done' && (
        <p className="mt-2 flex gap-[5px] text-[10.5px] font-medium leading-[14px] tracking-[0.1px] text-info">
          <PlaneIcon size={13} className="mt-[1px] shrink-0" />
          {t('tasks.deputy', { name: task.deputy.short })}
        </p>
      )}

      <div className="mt-[10px] flex items-center gap-[6px]">
        {task.assignee && (
          <span
            title={task.assignee.name}
            className={`flex size-5 items-center justify-center rounded-full text-[8.5px] font-semibold ${toneClasses[task.assignee.tone].bg} ${toneClasses[task.assignee.tone].text}`}
          >
            {initials(task.assignee.name)}
          </span>
        )}
        {task.fromEmail && <Meta Icon={MailSmallIcon} label={t('tasks.fromEmail')} />}
        {task.subtasks > 0 && (
          <Meta Icon={SubtasksIcon} count={task.subtasks} label={t('tasks.subtasks')} />
        )}
        {task.comments > 0 && (
          <Meta Icon={CommentIcon} count={task.comments} label={t('tasks.comments')} />
        )}
        {task.attachments > 0 && (
          <Meta Icon={PaperclipIcon} count={task.attachments} label={t('tasks.attachments')} />
        )}
        {task.reschedules > 0 && task.status !== 'done' && (
          <span
            className="ml-auto flex items-center gap-[3px] text-[10px] font-medium text-warning-text"
            title={t('tasks.reschedules', { count: task.reschedules })}
          >
            <RescheduleIcon size={12} />×{task.reschedules}
          </span>
        )}
      </div>
    </article>
  );
}
