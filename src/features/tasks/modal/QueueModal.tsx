import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatInBishkek, formatIsoDate, relativeShort } from '@/shared/lib/date';
import {
  AlertMiniIcon,
  CheckMiniIcon,
  DuplicateIcon,
  EditMediumIcon,
  FileIcon,
  MailHugeIcon,
  MailLetterIcon,
  PaperclipIcon,
  PlusMediumIcon,
  RejectIcon,
  SparkleIcon,
  XIcon,
} from '@/shared/ui/icons';
import {
  findSimilar,
  queueSummary,
  useCreateFromLetter,
  useMailQueue,
  useRejectLetter,
} from '../api';
import { dueProblem } from '../deadline';
import { people, projects } from '../directory';
import { canCreate, type Letter, type Suggestion, type SuggestionField } from '../mailQueue';
import { dueMessage } from './NewTaskModal';

const sectionTitle = 'text-[10px] font-semibold uppercase tracking-[1.4px] text-dim';
const staff = [people.ad, people.nb, people.dt, people.ka, people.me];
const projectList = Object.values(projects);
const fields: SuggestionField[] = ['title', 'assignee', 'due', 'project', 'priority'];

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenTask: (id: string) => void;
  /** Оформить письмо задачей вручную — открыть форму «Новая задача» */
  onManual: (letter: Letter) => void;
};

/** Очередь из почты (макет Figma): задача создаётся только после подтверждения человеком */
export function QueueModal({ open, onClose, onOpenTask, onManual }: Props) {
  const { t } = useTranslation();
  const queue = useMailQueue();
  const letters = queue.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ready = letters.filter((l) => l.suggestion);
  const manual = letters.filter((l) => !l.suggestion);
  const selected = letters.find((l) => l.id === selectedId) ?? ready[0] ?? null;
  const summary = { ready: ready.length, manual: manual.length };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex h-[min(780px,calc(100vh-48px))] w-[min(1240px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <header className="flex shrink-0 items-start gap-[10px] border-b border-line px-[27px] pb-[14px] pt-[23px]">
            <MailHugeIcon size={20} className="mt-[3px] text-tone-gold" />
            <div>
              <Dialog.Title className="text-[18px] font-semibold tracking-[-0.35px] text-text">
                {t('mailQueue.title')}
              </Dialog.Title>
              <p className="text-[12px] text-faint">
                {t('mailQueue.subtitle', { mailbox: 'info@olympic.kg', ...summary })}
              </p>
            </div>
            <Dialog.Close
              aria-label={t('taskCard.close')}
              className="ml-auto flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
            >
              <XIcon size={16} />
            </Dialog.Close>
          </header>

          {letters.length === 0 && !queue.isPending ? (
            <p className="flex flex-1 items-center justify-center text-[13px] text-sub">
              {t('mailQueue.empty')}
            </p>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-[376px_minmax(0,1fr)] gap-[14px] p-[23px] pt-4">
              <nav
                aria-label={t('mailQueue.title')}
                className="min-h-0 overflow-y-auto rounded-12 border border-line bg-column"
              >
                <GroupTitle tone="success" count={ready.length}>
                  {t('mailQueue.readyGroup')}
                </GroupTitle>
                <ul>
                  {ready.map((l) => (
                    <LetterRow
                      key={l.id}
                      letter={l}
                      selected={l.id === selected?.id}
                      onSelect={() => setSelectedId(l.id)}
                    />
                  ))}
                </ul>
                {manual.length > 0 && (
                  <div className="border-t border-line">
                    <GroupTitle tone="danger" count={manual.length}>
                      {t('mailQueue.manualGroup')}
                    </GroupTitle>
                    <ul>
                      {manual.map((l) => (
                        <LetterRow
                          key={l.id}
                          letter={l}
                          selected={false}
                          onManual={() => onManual(l)}
                        />
                      ))}
                    </ul>
                    <p className="px-[15px] pb-4 pt-1 text-[10.5px] leading-[15px] text-dim">
                      {t('mailQueue.manualNote')}
                    </p>
                  </div>
                )}
              </nav>
              <section className="min-h-0 overflow-y-auto rounded-12 border border-line bg-column p-[19px]">
                {selected?.suggestion ? (
                  <ParsedLetter
                    key={selected.id}
                    letter={selected}
                    onCreated={(taskId) => {
                      setSelectedId(null);
                      if (queueSummary().ready === 0) onClose();
                      onOpenTask(taskId);
                    }}
                    onRejected={() => setSelectedId(null)}
                  />
                ) : (
                  <p className="text-[12px] text-dim">{t('mailQueue.selectLetter')}</p>
                )}
              </section>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GroupTitle({
  tone,
  count,
  children,
}: {
  tone: 'success' | 'danger';
  count: number;
  children: ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 px-[15px] pb-2 pt-[14px]">
      <span className={sectionTitle}>{children}</span>
      <span
        className={`rounded-[5px] px-[6px] py-px text-[9.5px] font-semibold ${
          tone === 'success' ? 'bg-tone-green-bg text-success' : 'bg-danger-chip text-danger'
        }`}
      >
        {count}
      </span>
    </h3>
  );
}

function StateChip({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex h-[18px] items-center gap-1 rounded-[5px] px-[6px] text-[10px] font-medium ${
        ready ? 'bg-tone-green-bg text-tone-green' : 'bg-warning-chip text-warning-text'
      }`}
    >
      {ready ? <CheckMiniIcon size={11} /> : <AlertMiniIcon size={11} />}
      {ready ? t('mailQueue.stateReady') : t('mailQueue.stateCheck')}
    </span>
  );
}

function LetterRow({
  letter,
  selected,
  onSelect,
  onManual,
}: {
  letter: Letter;
  selected: boolean;
  onSelect?: () => void;
  onManual?: () => void;
}) {
  const { t } = useTranslation();
  const ready = letter.suggestion ? canCreate(letter.suggestion) : false;
  const content = (
    <>
      {selected && (
        <span aria-hidden className="absolute inset-y-0 left-0 w-[2.5px] bg-brand-gold" />
      )}
      <MailLetterIcon
        size={15}
        className={`mt-[2px] shrink-0 ${selected ? 'text-brand-gold' : 'text-faint'}`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={`flex-1 truncate text-[11px] font-medium tracking-[-0.1px] ${selected ? 'text-text' : 'text-sub'}`}
          >
            {letter.sender}
          </span>
          <time dateTime={letter.receivedAt} className="text-[10px] text-dim">
            {relativeShort(letter.receivedAt, t)}
          </time>
        </span>
        <span
          className={`mt-[2px] block truncate text-[12px] leading-4 ${selected ? 'text-sub' : 'text-faint'}`}
        >
          {letter.subject}
        </span>
        <span className="mt-[6px] flex items-center gap-2">
          {letter.suggestion ? (
            <StateChip ready={ready} />
          ) : (
            <button
              type="button"
              onClick={onManual}
              className="text-[10.5px] font-medium text-info hover:underline"
            >
              {t('mailQueue.manualAction')}
            </button>
          )}
          {letter.attachments.length > 0 && (
            <span className="ml-auto flex items-center gap-[3px] text-[10px] text-dim">
              <PaperclipIcon size={13} />
              {letter.attachments.length}
            </span>
          )}
        </span>
      </span>
    </>
  );
  return (
    <li className="border-b border-line last:border-b-0">
      {onSelect ? (
        <button
          type="button"
          aria-current={selected}
          onClick={onSelect}
          className={`relative flex w-full gap-[7px] px-4 py-3 text-left ${selected ? 'bg-control-active' : 'hover:bg-row-highlight'}`}
        >
          {content}
        </button>
      ) : (
        <div className="relative flex gap-[7px] px-4 py-3">{content}</div>
      )}
    </li>
  );
}

function ParsedLetter({
  letter,
  onCreated,
  onRejected,
}: {
  letter: Letter;
  onCreated: (taskId: string) => void;
  onRejected: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [draft, setDraft] = useState<Suggestion>(letter.suggestion as Suggestion);
  const [editing, setEditing] = useState<SuggestionField | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const create = useCreateFromLetter();
  useEffect(() => setDraft(letter.suggestion as Suggestion), [letter]);

  const problem = draft.due ? dueProblem(draft.due) : null;
  const ready = canCreate(draft) && !problem;
  const similar = findSimilar(draft.title);

  const confirmField = (field: SuggestionField) => {
    setDraft((d) => {
      const flags = { ...d.flags };
      delete flags[field];
      return { ...d, flags };
    });
    setEditing(null);
  };

  const display: Record<SuggestionField, string> = {
    title: draft.title,
    assignee: draft.assignee
      ? [draft.assignee.short, draft.assignee.unit].filter(Boolean).join(' · ')
      : '—',
    due: draft.due ? formatIsoDate(draft.due, 'd MMMM yyyy · EEEE', lang) : '—',
    project: draft.project?.name ?? t('newTask.noProject'),
    priority: t(`taskCard.priorityValue.${draft.priority}`),
  };

  const control = (field: SuggestionField) => {
    const cls =
      'h-7 w-full rounded-6 border border-line bg-panel px-2 text-[12px] text-text outline-none focus:border-info';
    const label = t('mailQueue.edit', { field: t(`mailQueue.field.${field}`) });
    switch (field) {
      case 'title':
        return (
          <input
            aria-label={label}
            className={cls}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        );
      case 'assignee':
        return (
          <select
            aria-label={label}
            className={cls}
            value={draft.assignee?.id ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, assignee: staff.find((p) => p.id === e.target.value) ?? null })
            }
          >
            <option value="">{t('newTask.selectAssignee')}</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short}
              </option>
            ))}
          </select>
        );
      case 'due':
        return (
          <input
            aria-label={label}
            type="date"
            className={`${cls} [color-scheme:dark]`}
            value={draft.due ?? ''}
            onChange={(e) => setDraft({ ...draft, due: e.target.value || null })}
          />
        );
      case 'project':
        return (
          <select
            aria-label={label}
            className={cls}
            value={draft.project?.id ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                project: projectList.find((p) => p.id === e.target.value) ?? null,
              })
            }
          >
            <option value="">{t('newTask.noProject')}</option>
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        );
      case 'priority':
        return (
          <select
            aria-label={label}
            className={cls}
            value={draft.priority}
            onChange={(e) =>
              setDraft({ ...draft, priority: e.target.value as Suggestion['priority'] })
            }
          >
            {(['low', 'normal', 'high'] as const).map((p) => (
              <option key={p} value={p}>
                {t(`taskCard.priorityValue.${p}`)}
              </option>
            ))}
          </select>
        );
    }
  };

  return (
    <>
      <h3 className={sectionTitle}>{t('mailQueue.letter')}</h3>
      <p className="mt-2 text-[17px] font-semibold leading-[23px] tracking-[-0.3px] text-text">
        {letter.subject}
      </p>
      <p className="mt-1 text-[11.5px] text-faint">
        {t('mailQueue.from', { organization: letter.organization, address: letter.address })}
      </p>
      <p className="text-[11.5px] text-faint">
        {t('mailQueue.received', {
          date: formatInBishkek(letter.receivedAt, 'd MMMM yyyy, HH:mm', lang),
        })}
      </p>
      <blockquote className="mt-3 rounded-9 border border-line bg-surface px-[13px] py-[11px] text-[11.5px] leading-4 text-sub">
        {letter.body}
      </blockquote>
      {letter.attachments.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {letter.attachments.map((a) => (
            <li
              key={a}
              className="flex h-7 items-center gap-[5px] rounded-[7px] border border-line bg-surface px-2 text-[10.5px] text-sub"
            >
              <FileIcon size={15} className="text-faint" />
              {a}
            </li>
          ))}
        </ul>
      )}

      <hr className="my-[18px] border-line" />
      <div className="flex items-center gap-[6px]">
        <SparkleIcon size={14} className="text-tone-violet" />
        <h3 className="text-[10px] font-semibold uppercase tracking-[1.4px] text-tone-violet">
          {t('mailQueue.suggestion')}
        </h3>
        <span className="ml-auto">
          <StateChip ready={ready} />
        </span>
      </div>

      {similar.length > 0 && (
        <div
          role="status"
          className="relative mt-3 flex gap-[9px] overflow-hidden rounded-9 border border-warning-line bg-warning-soft py-2 pl-[13px] pr-3"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-[2.5px] bg-warning" />
          <DuplicateIcon size={16} className="mt-[1px] shrink-0 text-warning-text" />
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-warning-text">
              {t('newTask.duplicatesTitle')}
            </p>
            {similar.map((s) => (
              <p key={s.id} className="truncate text-[10.5px] text-sub">
                {t('newTask.duplicateLine', {
                  title: s.title,
                  status: t(`tasks.status.${s.status}`).toLocaleLowerCase(lang),
                })}
              </p>
            ))}
          </div>
        </div>
      )}

      <dl className="mt-3 flex flex-col gap-1">
        {fields.map((field) => {
          const flag = draft.flags[field];
          return (
            <div
              key={field}
              className={`flex min-h-[38px] items-center gap-2 rounded-8 border bg-surface px-[11px] py-1 ${
                flag === 'missing'
                  ? 'border-danger-line'
                  : flag === 'confirm'
                    ? 'border-warning-line'
                    : 'border-line'
              }`}
            >
              <div className="min-w-0 flex-1">
                <dt className="text-[9.5px] tracking-[0.2px] text-dim">
                  {t(`mailQueue.field.${field}`)}
                </dt>
                <dd className="text-[12px] font-medium tracking-[-0.1px] text-text">
                  {editing === field ? control(field) : display[field]}
                </dd>
                {field === 'due' && problem && (
                  <p className="text-[11px] text-danger">
                    {(() => {
                      const [key, holiday] = dueMessage(problem).split('|');
                      return t(`newTask.${key}`, { name: holiday ? t(`holidays.${holiday}`) : '' });
                    })()}
                  </p>
                )}
              </div>
              {flag && editing !== field && (
                <span
                  className={`inline-flex h-[18px] items-center gap-1 rounded-[5px] px-[6px] text-[9.5px] font-medium ${
                    flag === 'missing'
                      ? 'bg-danger-chip text-danger'
                      : 'bg-warning-chip text-warning-text'
                  }`}
                >
                  <AlertMiniIcon size={11} />
                  {flag === 'missing' ? t('mailQueue.missing') : t('mailQueue.confirm')}
                </span>
              )}
              {editing === field ? (
                <button
                  type="button"
                  onClick={() => confirmField(field)}
                  disabled={field === 'assignee' && !draft.assignee}
                  className="h-7 rounded-6 bg-info px-3 text-[11px] font-semibold text-panel disabled:opacity-40"
                >
                  {t('mailQueue.done')}
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={t('mailQueue.edit', { field: t(`mailQueue.field.${field}`) })}
                  onClick={() => setEditing(field)}
                  className="flex h-5 w-[22px] items-center justify-center rounded-[5px] text-faint hover:text-text"
                >
                  <EditMediumIcon size={16} />
                </button>
              )}
            </div>
          );
        })}
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!ready || create.isPending}
          title={ready ? undefined : t('mailQueue.notFilled')}
          onClick={() =>
            create.mutate(
              { letterId: letter.id, suggestion: draft },
              { onSuccess: (task) => onCreated(task.id) },
            )
          }
          className="flex h-[42px] items-center gap-2 rounded-9 bg-brand-red px-4 text-[13px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusMediumIcon size={17} />
          {t('mailQueue.create')}
        </button>
        <button
          type="button"
          onClick={() => setRejecting(true)}
          className="flex h-[42px] items-center gap-2 rounded-9 border border-line px-[15px] text-[13px] font-medium tracking-[-0.1px] text-sub hover:text-text"
        >
          <RejectIcon size={17} />
          {t('mailQueue.reject')}
        </button>
      </div>
      <p className="mt-2 text-[10.5px] leading-[14px] text-dim">{t('mailQueue.rejectNote')}</p>
      <RejectDialog
        open={rejecting}
        letterId={letter.id}
        onClose={() => setRejecting(false)}
        onRejected={onRejected}
      />
    </>
  );
}

function RejectDialog({
  open,
  letterId,
  onClose,
  onRejected,
}: {
  open: boolean;
  letterId: string;
  onClose: () => void;
  onRejected: () => void;
}) {
  const { t } = useTranslation();
  const reject = useRejectLetter();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(false);

  const submit = () => {
    if (reason.trim().length < 5) {
      setError(true);
      return;
    }
    reject.mutate(
      { letterId, reason },
      {
        onSuccess: () => {
          setReason('');
          onClose();
          onRejected();
        },
      },
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(3,6,12,0.5)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[70] w-[min(460px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-18 border border-line bg-panel p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <Dialog.Title className="text-[16px] font-semibold text-text">
            {t('mailQueue.rejectTitle')}
          </Dialog.Title>
          <label
            htmlFor="reject-reason"
            className="mt-4 block text-[10.5px] font-medium tracking-[0.2px] text-sub"
          >
            {t('mailQueue.rejectReason')}
            <span className="text-brand-red"> *</span>
          </label>
          <textarea
            id="reject-reason"
            rows={3}
            value={reason}
            aria-invalid={error}
            onChange={(e) => {
              setReason(e.target.value);
              setError(false);
            }}
            placeholder={t('mailQueue.rejectPlaceholder')}
            className="mt-[6px] w-full resize-none rounded-8 border border-line bg-column px-3 py-2 text-[12.5px] text-text outline-none placeholder:text-dim focus:border-info aria-[invalid=true]:border-danger"
          />
          {error && <p className="mt-1 text-[11px] text-danger">{t('mailQueue.rejectError')}</p>}
          <p className="mt-2 text-[10.5px] text-dim">{t('mailQueue.rejectNote')}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-9 border border-line px-4 text-[12.5px] font-medium text-sub hover:text-text"
            >
              {t('mailQueue.rejectCancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              className="h-9 rounded-9 bg-brand-red px-4 text-[12.5px] font-semibold text-[#FFFFFF] hover:opacity-90"
            >
              {t('mailQueue.rejectConfirm')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
