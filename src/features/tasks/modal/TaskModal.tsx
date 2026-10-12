import * as Dialog from '@radix-ui/react-dialog';
import { type ComponentType, type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCan } from '@/features/auth';
import { formatInBishkek, formatIsoDate } from '@/shared/lib/date';
import { initials } from '@/shared/lib/text';
import { addDays, todayInBishkek } from '@/shared/lib/workDays';
import {
  AttachMediumIcon,
  BellSmallIcon,
  BoltMediumIcon,
  BookIcon,
  CheckTinyIcon,
  ExternalIcon,
  HistoryBoltIcon,
  HistoryClockIcon,
  HistoryMailIcon,
  HistorySwapIcon,
  MailMediumIcon,
  MovesIcon,
  PlaneMediumIcon,
  PlusSmallIcon,
  SendIcon,
  XIcon,
} from '@/shared/ui/icons';
import { absenceOf, isAbsentOn } from '../absences';
import { useAddComment, useAddSubtask, useTask, useToggleSubtask } from '../api';
import { urgencyOf } from '../deadline';
import type { HistoryEntry, HistoryKind, Person, TaskDetail, TaskStatus } from '../types';
import { toneClasses } from '../ui';

const sectionTitle = 'text-[10px] font-semibold uppercase tracking-[1.4px] text-dim';
const shortDate = (d: string, lang: string) => formatIsoDate(d, 'd MMM', lang).replace('.', '');

const statusChip: Record<TaskStatus, string> = {
  queue: 'bg-chip text-chip-text',
  in_progress: 'bg-info-chip text-info',
  review: 'bg-warning-chip text-warning-text',
  done: 'bg-tone-green-bg text-tone-green',
};

function Avatar({ person, size = 20 }: { person: Person; size?: number }) {
  const tone = toneClasses[person.tone];
  return (
    <span
      title={person.name}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tone.bg} ${tone.text}`}
    >
      {initials(person.name)}
    </span>
  );
}

function Notice({
  tone,
  Icon,
  title,
  children,
}: {
  tone: 'warning' | 'info' | 'neutral';
  Icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  children?: ReactNode;
}) {
  const box = {
    warning: 'border-warning-line bg-warning-soft',
    info: 'border-info-line bg-info-chip',
    neutral: 'border-line bg-surface',
  }[tone];
  const color = { warning: 'text-warning-text', info: 'text-info-text', neutral: 'text-sub' }[tone];
  return (
    <div className={`flex gap-[9px] rounded-8 border px-[11px] py-[7px] ${box}`}>
      <Icon size={15} className={`mt-px shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className={`text-[10.5px] font-semibold tracking-[-0.1px] ${color}`}>{title}</p>
        {children && <div className="mt-[2px] text-[10px] leading-[13px] text-sub">{children}</div>}
      </div>
    </div>
  );
}

/** Карточка задачи (макет Figma: «Карточка тикета»). Открывается по ?task=ID */
export function TaskModal({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const task = useTask(taskId);
  return (
    <Dialog.Root open={taskId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex h-[min(800px,calc(100vh-48px))] w-[min(1240px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          {task.data ? (
            <TaskBody task={task.data} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <Dialog.Title className="text-sub">
                {task.isPending ? '' : t('taskCard.notFound')}
              </Dialog.Title>
            </div>
          )}
          <Dialog.Close
            aria-label={t('taskCard.close')}
            className="absolute right-[29px] top-[21px] flex size-7 items-center justify-center rounded-[7px] text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TaskBody({ task }: { task: TaskDetail }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { urgency } = urgencyOf(task);
  const dueChip = {
    overdue: 'bg-danger-chip text-danger',
    soon: 'bg-warning-chip text-warning-text',
    week: 'bg-info-chip text-info-text',
    later: 'bg-chip text-chip-text',
    none: 'bg-muted-chip text-dim',
  }[urgency];

  return (
    <>
      <header className="flex h-[61px] shrink-0 items-center gap-2 border-b border-line pl-[27px] pr-[72px]">
        {task.project && (
          <>
            <span
              aria-hidden
              className={`size-[7px] rounded-full ${toneClasses[task.project.tone].dot}`}
            />
            <span className="text-[11px] font-medium tracking-[0.2px] text-faint">
              {task.project.name}
            </span>
          </>
        )}
        <span className="ml-auto text-[11px] font-medium tracking-[0.3px] text-dim">
          {task.code}
        </span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(320px,467px)]">
        <div className="min-h-0 overflow-y-auto px-7 pb-6 pt-[22px]">
          {task.escalatedAt && task.status !== 'done' && (
            <div className="relative mb-[18px] flex gap-[9px] overflow-hidden rounded-9 border border-warning-line bg-warning-soft py-2 pl-[15px] pr-3">
              <span aria-hidden className="absolute inset-y-0 left-0 w-[2.5px] bg-warning" />
              <BoltMediumIcon size={17} className="mt-[3px] shrink-0 text-warning-text" />
              <div>
                <p className="text-[12px] font-semibold tracking-[-0.1px] text-warning-text">
                  {t('taskCard.escalationTitle', { hours: task.escalationHours })}
                </p>
                <p className="text-[11px] text-sub">
                  {t('taskCard.escalationText', {
                    date: formatInBishkek(task.escalatedAt, 'd MMMM', lang),
                    time: formatInBishkek(task.escalatedAt, 'HH:mm', lang),
                  })}
                </p>
              </div>
            </div>
          )}

          <Dialog.Title className="text-[24px] font-semibold leading-[31px] tracking-[-0.5px] text-text">
            {task.title}
          </Dialog.Title>
          <div className="mt-[7px] flex flex-wrap gap-[7px]">
            <span
              className={`rounded-6 px-[9px] py-[5px] text-[11px] font-medium tracking-[0.1px] ${statusChip[task.status]}`}
            >
              {t(`tasks.status.${task.status}`)}
            </span>
            <span
              className={`rounded-6 px-[9px] py-[5px] text-[11px] font-medium tracking-[0.1px] ${dueChip}`}
            >
              {task.due
                ? t('taskCard.dueChip', { date: shortDate(task.due, lang) })
                : t('taskCard.noDue')}
            </span>
            {task.priority !== 'normal' && (
              <span
                className={`rounded-6 px-[9px] py-[5px] text-[11px] font-medium tracking-[0.1px] ${
                  task.priority === 'high' ? 'bg-danger-chip text-danger' : 'bg-chip text-chip-text'
                }`}
              >
                {t(`taskCard.priorityChip.${task.priority}`)}
              </span>
            )}
          </div>

          <hr className="my-[18px] border-line" />
          <h3 className={sectionTitle}>{t('taskCard.description')}</h3>
          <p className="mt-2 whitespace-pre-line text-[12.5px] leading-5 text-sub">
            {task.description || t('taskCard.noDescription')}
          </p>
          {task.knowledgeLink && (
            <Link
              to="/knowledge"
              className="mt-3 flex h-[38px] items-center gap-[9px] rounded-9 border border-line bg-surface px-[13px] text-[12px] font-medium tracking-[-0.1px] text-info hover:opacity-90"
            >
              <BookIcon size={17} />
              <span className="flex-1 truncate">
                {t('taskCard.knowledge', { title: task.knowledgeLink })}
              </span>
              <ExternalIcon size={15} className="text-faint" />
            </Link>
          )}

          <Subtasks task={task} />
          <hr className="my-4 border-line" />
          <Discussion task={task} />
        </div>
        <Side task={task} />
      </div>
    </>
  );
}

function Subtasks({ task }: { task: TaskDetail }) {
  const { t } = useTranslation();
  const { can } = useCan();
  const toggle = useToggleSubtask();
  const add = useAddSubtask();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const editable = can('tasks.edit');
  const done = task.subtaskItems.filter((s) => s.done).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return;
    add.mutate({ taskId: task.id, title: title.trim() });
    setTitle('');
    setAdding(false);
  };

  return (
    <section className="mt-5">
      <h3 className="flex items-baseline gap-[14px]">
        <span className={sectionTitle}>{t('taskCard.subtasks')}</span>
        {task.subtaskItems.length > 0 && (
          <span className="text-[10.5px] font-medium tracking-[0.2px] text-faint">
            {t('tasks.shownOf', { shown: done, total: task.subtaskItems.length })}
          </span>
        )}
      </h3>
      <ul className="mt-2">
        {task.subtaskItems.map((s) => (
          <li key={s.id}>
            <label
              className={`flex h-[30px] items-center gap-[10px] rounded-[7px] ${editable ? 'cursor-pointer' : ''}`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={s.done}
                disabled={!editable}
                onChange={() => toggle.mutate({ taskId: task.id, subtaskId: s.id })}
              />
              <span
                aria-hidden
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] peer-focus-visible:ring-2 peer-focus-visible:ring-info ${
                  s.done ? 'bg-success text-panel' : 'border-[1.4px] border-dim'
                }`}
              >
                {s.done && <CheckTinyIcon size={12} />}
              </span>
              <span
                className={`flex-1 text-[12.5px] tracking-[-0.1px] ${s.done ? 'text-faint' : 'text-text'}`}
              >
                {s.title}
              </span>
              {s.assignee && <Avatar person={s.assignee} size={18} />}
            </label>
          </li>
        ))}
      </ul>
      {editable &&
        (adding ? (
          <form onSubmit={submit} className="mt-1 flex gap-2">
            <input
              // biome-ignore lint/a11y/noAutofocus: поле появляется по нажатию «Добавить подзадачу»
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title && setAdding(false)}
              placeholder={t('taskCard.newSubtask')}
              aria-label={t('taskCard.newSubtask')}
              className="h-8 flex-1 rounded-8 border border-line bg-column px-3 text-[12.5px] text-text outline-none focus:border-info"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1 flex h-7 items-center gap-[6px] text-[11.5px] text-dim hover:text-sub"
          >
            <PlusSmallIcon size={14} />
            {t('taskCard.addSubtask')}
          </button>
        ))}
    </section>
  );
}

const VISIBLE_COMMENTS = 2;

function Discussion({ task }: { task: TaskDetail }) {
  const { t, i18n } = useTranslation();
  const add = useAddComment();
  const [all, setAll] = useState(false);
  const [text, setText] = useState('');
  const hidden = all ? 0 : Math.max(0, task.commentItems.length - VISIBLE_COMMENTS);
  const visible = task.commentItems.slice(hidden);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    add.mutate({ taskId: task.id, text: text.trim() });
    setText('');
  };

  return (
    <section>
      <h3 className="flex items-baseline gap-[14px]">
        <span className={sectionTitle}>{t('taskCard.discussion')}</span>
        <span className="text-[10.5px] font-medium tracking-[0.2px] text-faint">
          {task.commentItems.length}
        </span>
      </h3>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-2 text-[11.5px] font-medium text-info hover:underline"
        >
          {t('taskCard.showMoreComments', { count: hidden })}
        </button>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {visible.map((c) => (
          <li key={c.id} className="flex gap-[10px]">
            <Avatar person={c.author} size={26} />
            <div className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className="text-[12px] font-medium tracking-[-0.1px] text-text">
                  {c.author.short}
                </span>
                <time dateTime={c.at} className="text-[10.5px] text-dim">
                  {formatInBishkek(c.at, 'd MMM, HH:mm', i18n.language)}
                </time>
              </p>
              <p className="mt-[2px] text-[12px] leading-[18px] text-sub">{c.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <form
        onSubmit={submit}
        className="mt-[10px] flex h-10 items-center gap-1 rounded-9 border border-line bg-surface pl-[13px] pr-[6px] focus-within:border-info"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('taskCard.writeComment')}
          aria-label={t('taskCard.writeComment')}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-text outline-none placeholder:text-dim"
        />
        <button
          type="button"
          disabled
          title={t('tasks.comingSoon')}
          aria-label={t('taskCard.attach')}
          className="flex size-6 items-center justify-center rounded-6 text-faint disabled:cursor-not-allowed"
        >
          <AttachMediumIcon size={16} />
        </button>
        <button
          type="submit"
          aria-label={t('taskCard.send')}
          disabled={!text.trim()}
          className="flex size-6 items-center justify-center rounded-6 text-info disabled:opacity-40"
        >
          <SendIcon size={16} />
        </button>
      </form>
    </section>
  );
}

const historyIcons: Record<HistoryKind, ComponentType<{ size?: number; className?: string }>> = {
  escalation: HistoryBoltIcon,
  assignee: HistorySwapIcon,
  due: HistoryClockIcon,
  created: HistoryMailIcon,
  status: HistorySwapIcon,
  subtask: CheckTinyIcon,
  comment: HistoryMailIcon,
};

const historyColor: Partial<Record<HistoryKind, string>> = {
  escalation: 'text-warning-text',
  assignee: 'text-info',
  due: 'text-faint',
  created: 'text-tone-gold',
  subtask: 'text-success',
};

function historyText(
  entry: HistoryEntry,
  t: (k: string, o?: Record<string, unknown>) => string,
  lang: string,
) {
  switch (entry.kind) {
    case 'escalation':
      return t('taskCard.historyEscalation');
    case 'due': {
      const [from, to] = entry.text.split('|');
      return t('taskCard.historyDue', { from: shortDate(from, lang), to: shortDate(to, lang) });
    }
    case 'created':
      return entry.text === 'email'
        ? t('taskCard.historyCreatedEmail')
        : t('taskCard.historyCreatedManual');
    case 'subtask': {
      const [action, title] = entry.text.split('|');
      const key = {
        done: 'historySubtaskDone',
        undone: 'historySubtaskUndone',
        added: 'historySubtaskAdded',
      }[action];
      return t(`taskCard.${key}`, { title });
    }
    default:
      return entry.text;
  }
}

function Side({ task }: { task: TaskDetail }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const absence = absenceOf(task.assignee?.id);
  const absentNow = absence !== null && isAbsentOn(absence, todayInBishkek());
  const row = 'grid grid-cols-[138px_minmax(0,1fr)] items-center gap-2 py-[5px]';
  const label = 'text-[11px] text-faint';
  const value = 'text-[12px] font-medium tracking-[-0.1px] text-text';

  return (
    <aside className="min-h-0 overflow-y-auto border-l border-line bg-column px-[22px] pb-6 pt-[22px]">
      <h3 className={sectionTitle}>{t('taskCard.properties')}</h3>
      <dl className="mt-2">
        <div className={row}>
          <dt className={label}>{t('taskCard.assignee')}</dt>
          <dd className={`flex items-center gap-[6px] ${value}`}>
            {task.assignee ? (
              <>
                <Avatar person={task.assignee} size={22} />
                {task.assignee.short}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        {absence && absentNow && (
          <div className="mb-2 mt-1">
            <Notice
              tone="info"
              Icon={PlaneMediumIcon}
              title={t('taskCard.absenceTitle', {
                date: formatIsoDate(absence.to, 'd MMMM', lang),
              })}
            >
              {t('taskCard.absenceText', { name: absence.deputy.short })}
            </Notice>
          </div>
        )}
        <div className={row}>
          <dt className={label}>{t('taskCard.author')}</dt>
          <dd className={value}>{task.author.short}</dd>
        </div>
        <div className={row}>
          <dt className={label}>{t('taskCard.department')}</dt>
          <dd className={value}>{task.department}</dd>
        </div>
        <div className={row}>
          <dt className={label}>{t('taskCard.project')}</dt>
          <dd className={`flex items-center gap-[6px] ${value}`}>
            {task.project ? (
              <>
                <span
                  aria-hidden
                  className={`size-[6px] rounded-full ${toneClasses[task.project.tone].dot}`}
                />
                {task.project.name}
              </>
            ) : (
              t('newTask.noProject')
            )}
          </dd>
        </div>
        <div className={row}>
          <dt className={label}>{t('taskCard.priority')}</dt>
          <dd className={`${value} ${task.priority === 'high' ? '!text-danger' : ''}`}>
            {t(`taskCard.priorityValue.${task.priority}`)}
          </dd>
        </div>
        <div className={row}>
          <dt className={label}>{t('taskCard.due')}</dt>
          <dd className={value}>
            {task.due ? formatIsoDate(task.due, 'd MMMM · EEEE', lang) : t('taskCard.noDue')}
          </dd>
        </div>
      </dl>

      <div className="mt-1 flex flex-col gap-[10px]">
        {task.rescheduleLog.length > 0 && (
          <Notice
            tone="warning"
            Icon={MovesIcon}
            title={t('taskCard.moves', { count: task.rescheduleLog.length })}
          >
            {task.rescheduleLog.map((r) => (
              <p key={`${r.from}-${r.to}`}>
                {shortDate(r.from, lang)} → {shortDate(r.to, lang)} · {r.by.short}
              </p>
            ))}
          </Notice>
        )}
        {task.reminderDays !== null && task.due && (
          <Notice
            tone="neutral"
            Icon={BellSmallIcon}
            title={t('taskCard.reminder', { count: task.reminderDays })}
          >
            {t('taskCard.reminderText', {
              date: formatIsoDate(addDays(task.due, -task.reminderDays), 'd MMMM', lang),
            })}
          </Notice>
        )}
      </div>

      <div className={`${row} mt-3`}>
        <span className={label}>{t('taskCard.source')}</span>
        {task.source.kind === 'email' ? (
          <span>
            <span className="flex items-center gap-[5px] text-[11.5px] font-medium tracking-[-0.1px] text-warning-text">
              <MailMediumIcon size={14} />
              {t('taskCard.sourceEmail')}
            </span>
            <span className="text-[10.5px] text-dim">
              {task.source.mailbox} · {formatInBishkek(task.source.at, 'd MMMM', lang)}
            </span>
          </span>
        ) : (
          <span className={value}>{t('taskCard.sourceManual')}</span>
        )}
      </div>

      <hr className="my-4 border-line" />
      <h3 className={sectionTitle}>{t('taskCard.history')}</h3>
      <ol className="mt-3">
        {task.history.map((h) => {
          const Icon = historyIcons[h.kind];
          return (
            <li key={h.id} className="flex gap-[7px] border-b border-line py-[6px] last:border-b-0">
              <Icon
                size={13}
                className={`mt-px shrink-0 ${historyColor[h.kind] ?? 'text-faint'}`}
              />
              <div>
                <p className="text-[11px] leading-[15px] text-sub">{historyText(h, t, lang)}</p>
                <time dateTime={h.at} className="text-[10px] text-dim">
                  {formatInBishkek(h.at, 'd MMM HH:mm', lang)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-[10.5px] leading-[14px] text-dim">{t('taskCard.journalNote')}</p>
    </aside>
  );
}
