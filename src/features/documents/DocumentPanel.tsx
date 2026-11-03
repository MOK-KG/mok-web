import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCan } from '@/features/auth';
import { useDocumentArticles } from '@/features/knowledge-base/api';
import { Avatar } from '@/features/knowledge-base/parts';
import { useTasks } from '@/features/tasks/api';
import { dueProblem } from '@/features/tasks/deadline';
import { people } from '@/features/tasks/directory';
import { dueMessage } from '@/features/tasks/modal/NewTaskModal';
import type { Person } from '@/features/tasks/types';
import { formatInBishkek, formatIsoDate } from '@/shared/lib/date';
import { addWorkingDays, todayInBishkek } from '@/shared/lib/workDays';
import { BookIcon, FileIcon, XIcon } from '@/shared/ui/icons';
import { docNumber, docRef, useAnnul, useDocument, useIssue, useMarkDone, useResolve } from './api';
import {
  capsTitle,
  FieldError,
  fieldBox,
  label,
  primaryButton,
  StatusChip,
  secondaryButton,
} from './parts';
import type { DocumentRecord } from './types';

// Как в форме новой задачи
const staff: Person[] = [people.ad, people.nb, people.dt, people.ka, people.me];

/** Карточка документа справа: поля, резолюция, действия по правам, журнал */
export function DocumentPanel({ docId, onClose }: { docId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const query = useDocument(docId);
  const doc = query.data;

  return (
    <Dialog.Root open={docId !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.45)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-4 right-4 z-50 flex w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          {doc ? (
            <Body doc={doc} />
          ) : (
            <Dialog.Title className="p-6 text-[13px] text-dim">
              {query.isPending ? t('documents.loading') : t('documents.notFound')}
            </Dialog.Title>
          )}
          <Dialog.Close
            aria-label={t('taskCard.close')}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ doc }: { doc: DocumentRecord }) {
  const { t, i18n } = useTranslation();
  const { can } = useCan();
  const [form, setForm] = useState<'resolution' | 'annul' | null>(null);
  const issue = useIssue();
  const markDone = useMarkDone();
  const number = docNumber(doc);
  const date = (d: string) => formatIsoDate(d, 'd MMMM yyyy', i18n.language);

  const rows: [string, string | null][] = [
    [t('documents.field.kind'), t(`documents.kind.${doc.kind}`)],
    [t(`documents.field.date.${doc.seq === null ? 'draft' : doc.kind}`), date(doc.date)],
    [doc.kind === 'incoming' ? t('documents.field.from') : t('documents.field.to'), doc.party],
    [t('documents.field.senderRef'), doc.senderRef],
    [t(`documents.field.author.${doc.kind}`), doc.author.short],
    [t('documents.field.signer'), doc.signer?.short ?? null],
  ];

  return (
    <>
      <div className="border-b border-line px-6 pb-4 pt-5 pr-14">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-faint">
            {number ?? t('documents.noNumber')}
          </span>
          <StatusChip status={doc.status} />
        </div>
        <Dialog.Title className="mt-2 text-[17px] font-semibold leading-[22px] tracking-[-0.3px] text-text">
          {doc.title}
        </Dialog.Title>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <dl className="mt-3 divide-y divide-line">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex gap-3 py-[7px] text-[12px]">
                <dt className="w-[150px] shrink-0 text-faint">{k}</dt>
                <dd className="min-w-0 text-text">{v}</dd>
              </div>
            ))}
        </dl>

        {doc.summary && (
          <p className="mt-4 whitespace-pre-line text-[12.5px] leading-[19px] text-sub">
            {doc.summary}
          </p>
        )}

        {doc.attachments.length > 0 && (
          <ul className="mt-4 flex flex-col gap-[6px]">
            {doc.attachments.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 rounded-8 border border-line bg-surface px-3 py-2 text-[12px] text-sub"
              >
                <FileIcon size={14} className="shrink-0 text-faint" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        )}

        {doc.annulment && (
          <div
            role="note"
            className="mt-4 rounded-9 border border-danger-line bg-danger-chip px-4 py-3 text-[12px] text-danger"
          >
            <p className="font-semibold">{t('documents.annulledTitle')}</p>
            <p className="mt-1 text-sub">{doc.annulment.reason}</p>
            <p className="mt-1 text-[11px] text-faint">
              {doc.annulment.by.short} ·{' '}
              {formatInBishkek(doc.annulment.at, 'd MMM, HH:mm', i18n.language)}
              {number && ` · ${t('documents.numberKept', { number })}`}
            </p>
          </div>
        )}

        {doc.resolution && <ResolutionBlock doc={doc} />}

        {form === 'resolution' && <ResolutionForm doc={doc} onDone={() => setForm(null)} />}
        {form === 'annul' && <AnnulForm doc={doc} onDone={() => setForm(null)} />}

        {form === null && (
          <div className="mt-5 flex flex-wrap gap-2">
            {doc.status === 'registered' && can('documents.resolve') && (
              <button type="button" className={primaryButton} onClick={() => setForm('resolution')}>
                {t('documents.action.resolve')}
              </button>
            )}
            {doc.status === 'inWork' && can('documents.resolve') && (
              <button
                type="button"
                className={primaryButton}
                disabled={markDone.isPending}
                onClick={() => markDone.mutate(doc.id)}
              >
                {t('documents.action.done')}
              </button>
            )}
            {doc.status === 'draft' && can('documents.register') && (
              <button
                type="button"
                className={primaryButton}
                disabled={issue.isPending}
                onClick={() => issue.mutate(doc.id)}
              >
                {t(`documents.action.issue.${doc.kind}`)}
              </button>
            )}
            {doc.status !== 'annulled' && can('documents.annul') && (
              <button type="button" className={secondaryButton} onClick={() => setForm('annul')}>
                {t('documents.action.annul')}
              </button>
            )}
          </div>
        )}
        {doc.status === 'draft' && (
          <p className="mt-2 text-[11px] leading-4 text-dim">{t('documents.issueHint')}</p>
        )}

        {can('knowledge.view') && <Articles doc={doc} />}

        <h3 className={`${capsTitle} mt-6`}>{t('documents.history')}</h3>
        <ol className="mt-2 flex flex-col gap-[10px] border-l border-line pl-4">
          {doc.history.map((h) => (
            <li key={h.id} className="text-[12px]">
              <p className="text-sub">
                <span className="text-text">{h.by.short}</span> ·{' '}
                {t(`documents.historyKind.${h.kind}`)}
              </p>
              {h.text && <p className="mt-[2px] text-[11.5px] text-faint">«{h.text}»</p>}
              <p className="mt-[2px] text-[10.5px] text-dim">
                {formatInBishkek(h.at, 'd MMM yyyy, HH:mm', i18n.language)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function ResolutionBlock({ doc }: { doc: DocumentRecord }) {
  const { t, i18n } = useTranslation();
  const r = doc.resolution;
  const active = useTasks('department').data ?? [];
  const done = useTasks('completed').data ?? [];
  if (!r) return null;
  const task = [...active, ...done].find((x) => x.title === r.taskTitle);
  return (
    <section className="mt-5 rounded-11 border border-info-line bg-info-chip px-4 py-3">
      <h3 className={capsTitle}>{t('documents.resolution')}</h3>
      <p className="mt-2 text-[13px] leading-[18px] text-text">«{r.text}»</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-sub">
        <span className="flex items-center gap-[6px]">
          <Avatar person={r.assignee} size={20} />
          {r.assignee.short}
        </span>
        <span className="text-dim">·</span>
        {t('documents.dueTo', { date: formatIsoDate(r.due, 'd MMMM', i18n.language) })}
      </p>
      <p className="mt-1 text-[10.5px] text-dim">
        {r.author.short} · {formatInBishkek(r.at, 'd MMM, HH:mm', i18n.language)}
      </p>
      {task && (
        <Link
          to={`/tasks?task=${task.id}`}
          className="mt-3 inline-flex items-center gap-2 text-[12px] font-medium text-info hover:underline"
        >
          {t('documents.openTask', { code: task.code })}
        </Link>
      )}
    </section>
  );
}

function ResolutionForm({ doc, onDone }: { doc: DocumentRecord; onDone: () => void }) {
  const { t } = useTranslation();
  const resolve = useResolve();
  const [text, setText] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [due, setDue] = useState(addWorkingDays(todayInBishkek(), 5));
  const [tried, setTried] = useState(false);

  const textError = text.trim().length < 3 ? t('documents.form.errorResolution') : null;
  const assigneeError = assigneeId ? null : t('newTask.errorAssignee');
  const problem = due ? dueProblem(due) : null;
  const dueError = !due
    ? t('newTask.errorDue')
    : problem
      ? (() => {
          const [key, holiday] = dueMessage(problem).split('|');
          return t(`newTask.${key}`, { name: holiday ? t(`holidays.${holiday}`) : '' });
        })()
      : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    const assignee = staff.find((p) => p.id === assigneeId);
    if (textError || dueError || !assignee) return;
    resolve.mutate({ id: doc.id, text, assignee, due }, { onSuccess: onDone });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-5 flex flex-col gap-3 rounded-11 border border-line bg-surface p-4"
    >
      <h3 className={capsTitle}>{t('documents.action.resolve')}</h3>
      <div>
        <label htmlFor="res-text" className={label}>
          {t('documents.form.resolutionText')}
        </label>
        <textarea
          id="res-text"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={tried && !!textError}
          data-invalid={tried && !!textError}
          className={`${fieldBox} mt-[6px] py-[9px]`}
          placeholder={t('documents.form.resolutionPlaceholder')}
        />
        <FieldError text={tried ? textError : null} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="res-assignee" className={label}>
            {t('newTask.assignee')}
          </label>
          <select
            id="res-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            aria-invalid={tried && !!assigneeError}
            data-invalid={tried && !!assigneeError}
            className={`${fieldBox} mt-[6px]`}
          >
            <option value="">{t('newTask.selectAssignee')}</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short}
              </option>
            ))}
          </select>
          <FieldError text={tried ? assigneeError : null} />
        </div>
        <div>
          <label htmlFor="res-due" className={label}>
            {t('newTask.due')}
          </label>
          <input
            id="res-due"
            type="date"
            min={todayInBishkek()}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-invalid={!!dueError}
            data-invalid={!!dueError}
            className={`${fieldBox} mt-[6px]`}
          />
          <FieldError text={dueError} />
        </div>
      </div>
      <p className="text-[11px] leading-4 text-faint">{t('documents.resolutionHint')}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={onDone}>
          {t('documents.cancel')}
        </button>
        <button type="submit" className={primaryButton} disabled={resolve.isPending}>
          {t('documents.form.submitResolution')}
        </button>
      </div>
    </form>
  );
}

function AnnulForm({ doc, onDone }: { doc: DocumentRecord; onDone: () => void }) {
  const { t } = useTranslation();
  const annul = useAnnul();
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const error = reason.trim().length < 5 ? t('documents.form.errorReason') : null;
  const number = docNumber(doc);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!error) annul.mutate({ id: doc.id, reason }, { onSuccess: onDone });
      }}
      className="mt-5 flex flex-col gap-3 rounded-11 border border-danger-line bg-surface p-4"
    >
      <h3 className={capsTitle}>{t('documents.action.annul')}</h3>
      <p className="text-[12px] leading-[17px] text-sub">
        {number ? t('documents.annulHint', { number }) : t('documents.annulDraftHint')}
      </p>
      <div>
        <label htmlFor="annul-reason" className={label}>
          {t('documents.form.reason')}
        </label>
        <textarea
          id="annul-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={tried && !!error}
          data-invalid={tried && !!error}
          className={`${fieldBox} mt-[6px] py-[9px]`}
        />
        <FieldError text={tried ? error : null} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={onDone}>
          {t('documents.cancel')}
        </button>
        <button type="submit" className={primaryButton} disabled={annul.isPending}>
          {t('documents.action.annul')}
        </button>
      </div>
    </form>
  );
}

/** Статьи Базы знаний, где упомянут документ */
function Articles({ doc }: { doc: DocumentRecord }) {
  const { t } = useTranslation();
  const ref = docRef(doc);
  const articles = useDocumentArticles(ref ? { number: ref, title: doc.title } : null).data ?? [];
  if (articles.length === 0) return null;
  return (
    <>
      <h3 className={`${capsTitle} mt-6`}>{t('documents.articles')}</h3>
      <ul className="mt-2 flex flex-col gap-[6px]">
        {articles.map((a) => (
          <li key={a.id}>
            <Link
              to={`/knowledge/${a.id}`}
              className="flex items-center gap-2 text-[12.5px] text-info hover:underline"
            >
              <BookIcon size={14} className="shrink-0" />
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
