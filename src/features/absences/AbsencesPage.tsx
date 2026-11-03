import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { useCan } from '@/features/auth';
import {
  FieldError,
  FormDialog,
  fieldBox,
  label,
  primaryButton,
  secondaryButton,
} from '@/features/documents/parts';
import { Avatar } from '@/features/knowledge-base/parts';
import { type Absence, type AbsenceKind, absenceKinds } from '@/features/tasks/absences';
import { useTasks } from '@/features/tasks/api';
import { currentUserId, people } from '@/features/tasks/directory';
import type { Person } from '@/features/tasks/types';
import { formatIsoDate } from '@/shared/lib/date';
import { diffDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { PlaneIcon, PlusIcon } from '@/shared/ui/icons';
import {
  type AbsenceInput,
  type AbsenceProblem,
  absenceProblems,
  absenceWorkingDays,
  useAbsences,
  useCancelAbsence,
  useCreateAbsence,
} from './api';

const staff: Person[] = [people.ad, people.nb, people.dt, people.ka, people.me, people.ju];
const me = staff.find((p) => p.id === currentUserId) ?? people.ad;

type Group = 'now' | 'upcoming' | 'past' | 'cancelled';
const groupsOrder: Group[] = ['now', 'upcoming', 'past', 'cancelled'];

function groupOf(a: Absence, today: IsoDate): Group {
  if (a.status === 'cancelled') return 'cancelled';
  if (diffDays(today, a.from) > 0) return 'upcoming';
  if (diffDays(a.to, today) > 0) return 'past';
  return 'now';
}

const kindTone: Record<AbsenceKind, string> = {
  vacation: 'bg-info-chip text-info-text',
  trip: 'bg-tone-violet-bg text-tone-violet',
};

/** Ключ и параметры текста проблемы для перевода absences.problem.* */
function useProblemText() {
  const { t, i18n } = useTranslation();
  const date = (d: IsoDate) => formatIsoDate(d, 'd MMM', i18n.language).replace('.', '');
  return (p: AbsenceProblem) =>
    p.code === 'overlap' || p.code === 'deputyAbsent'
      ? t(`absences.problem.${p.code}`, {
          name: p.with.person.short,
          from: date(p.with.from),
          to: date(p.with.to),
        })
      : t(`absences.problem.${p.code}`);
}

/**
 * Отпуск и командировки (S-29): кто и когда отсутствует, кто замещает. Без заместителя
 * сохранить нельзя (приёмка 11.10); права заместителя прекращаются в дату окончания сами
 * (11.11). Свои отсутствия оформляет каждый; за других — те, кто управляет сотрудниками
 * или назначает задачи. Отсутствие не удаляется — отменяется с причиной.
 */
export function AbsencesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useCan();
  const canManage = can('staff.manage') || can('tasks.assign');
  const today = todayInBishkek();
  const list = useAbsences().data ?? [];
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<Absence | null>(null);
  const [onlyMine, setOnlyMine] = useState(!canManage);

  const visible = list.filter((a) => !onlyMine || a.person.id === me.id || a.deputy.id === me.id);
  const grouped = groupsOrder.map((g) => ({
    group: g,
    items: visible
      .filter((a) => groupOf(a, today) === g)
      .sort((a, b) =>
        g === 'past' || g === 'cancelled'
          ? b.from.localeCompare(a.from)
          : a.from.localeCompare(b.from),
      ),
  }));
  const nowCount = grouped[0].items.length;
  usePageSubtitle(t('absences.subtitle', { count: nowCount }));
  const date = (d: IsoDate) => formatIsoDate(d, 'd MMM', i18n.language).replace('.', '');

  return (
    <div className="flex flex-col gap-3 pb-4 leading-[normal]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          className="flex h-9 items-center gap-1 rounded-9 border border-line bg-control p-[3px]"
        >
          {[false, true].map((mine) => (
            <button
              key={String(mine)}
              type="button"
              role="tab"
              aria-selected={onlyMine === mine}
              onClick={() => setOnlyMine(mine)}
              className={`h-full rounded-[7px] px-3 text-[12px] ${
                onlyMine === mine
                  ? 'bg-control-active font-semibold text-text'
                  : 'text-sub hover:text-text'
              }`}
            >
              {t(mine ? 'absences.mine' : 'absences.everyone')}
            </button>
          ))}
        </div>
        <button type="button" className={primaryButton} onClick={() => setCreating(true)}>
          <PlusIcon size={15} />
          {t('absences.new')}
        </button>
      </div>

      {grouped.map(({ group, items }) => (
        <section
          key={group}
          aria-label={t(`absences.group.${group}`)}
          className="rounded-14 border border-line bg-panel"
        >
          <h2 className="flex items-baseline gap-2 px-[18px] pb-2 pt-4 text-[13.5px] font-semibold tracking-[-0.2px] text-text">
            {t(`absences.group.${group}`)}
            <span className="text-[11px] font-medium text-dim">{items.length}</span>
          </h2>
          {items.length === 0 ? (
            <p className="px-[18px] pb-4 text-[12.5px] text-dim">{t(`absences.empty.${group}`)}</p>
          ) : (
            <ul className="pb-[6px]">
              {items.map((a) => {
                const canCancel =
                  group !== 'past' && group !== 'cancelled' && (canManage || a.person.id === me.id);
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 border-t border-line px-[18px] py-3 first:border-t-0"
                  >
                    <Avatar person={a.person} size={24} />
                    <div className="min-w-[200px] flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] text-text">
                        {a.person.name}
                        <span
                          className={`inline-flex h-5 items-center rounded-[5px] px-[7px] text-[10.5px] font-medium ${kindTone[a.kind]}`}
                        >
                          {t(`absences.kind.${a.kind}`)}
                        </span>
                      </p>
                      <p className="mt-[3px] text-[11.5px] text-faint">
                        {date(a.from)} – {date(a.to)} ·{' '}
                        {t('absences.workingDays', { count: absenceWorkingDays(a.from, a.to) })}
                        {a.note && ` · ${a.note}`}
                      </p>
                      {a.cancellation && (
                        <p className="mt-[3px] text-[11.5px] text-danger">
                          {t('absences.cancelledBy', {
                            by: a.cancellation.by,
                            reason: a.cancellation.reason,
                          })}
                        </p>
                      )}
                    </div>
                    <div className="min-w-[180px] text-[12px]">
                      <p className="flex items-center gap-[6px] text-sub">
                        <PlaneIcon size={12} className="shrink-0 text-info" />
                        {t('absences.deputyIs', { name: a.deputy.short })}
                      </p>
                      {(group === 'now' || group === 'upcoming') && (
                        <p className="mt-[3px] text-[11px] text-dim">
                          {t('absences.rightsUntil', { from: date(a.from), to: date(a.to) })}
                        </p>
                      )}
                    </div>
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setCancelling(a)}
                        className="h-8 rounded-8 border border-line px-3 text-[12px] text-sub hover:text-text"
                      >
                        {t('absences.cancel')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      <FormDialog open={creating} title={t('absences.new')} onClose={() => setCreating(false)}>
        <AbsenceForm canManage={canManage} onDone={() => setCreating(false)} />
      </FormDialog>
      <FormDialog
        open={cancelling !== null}
        title={t('absences.cancelTitle')}
        onClose={() => setCancelling(null)}
        width={460}
      >
        {cancelling && <CancelForm absence={cancelling} onDone={() => setCancelling(null)} />}
      </FormDialog>
    </div>
  );
}

function AbsenceForm({ canManage, onDone }: { canManage: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const create = useCreateAbsence(me.short);
  const problemText = useProblemText();
  const today = todayInBishkek();
  const [kind, setKind] = useState<AbsenceKind>('vacation');
  const [personId, setPersonId] = useState(me.id);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [deputyId, setDeputyId] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const person = staff.find((p) => p.id === personId) ?? me;
  const deputy = staff.find((p) => p.id === deputyId) ?? null;
  const tasks = useTasks('department').data ?? [];

  const input: AbsenceInput = { kind, person, from, to, deputy, note };
  const datesSet = from !== '' && to !== '';
  const problems = datesSet ? absenceProblems(input) : [];
  // Пока не нажали «Сохранить», не ругаемся на пустого заместителя — только на конфликты
  const shownProblems = problems.filter((p) => tried || p.code !== 'deputyRequired');
  const days = datesSet ? absenceWorkingDays(from, to) : 0;
  const affected = datesSet
    ? tasks.filter(
        (x) =>
          x.assignee?.id === person.id &&
          x.status !== 'done' &&
          x.due &&
          diffDays(from, x.due) >= 0 &&
          diffDays(x.due, to) >= 0,
      ).length
    : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!datesSet || problems.length > 0) return;
    create.mutate(input, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
      <fieldset className="flex gap-1 rounded-9 border border-line bg-control p-[3px]">
        <legend className="sr-only">{t('absences.kindLabel')}</legend>
        {absenceKinds.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`h-8 flex-1 rounded-[7px] text-[12.5px] ${
              kind === k ? 'bg-control-active font-semibold text-text' : 'text-sub hover:text-text'
            }`}
          >
            {t(`absences.kind.${k}`)}
          </button>
        ))}
      </fieldset>

      {canManage && (
        <div>
          <label htmlFor="abs-person" className={label}>
            {t('absences.person')}
          </label>
          <select
            id="abs-person"
            value={personId}
            onChange={(e) => {
              setPersonId(e.target.value);
              if (e.target.value === deputyId) setDeputyId('');
            }}
            className={`${fieldBox} mt-[6px]`}
          >
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="abs-from" className={label}>
            {t('absences.from')}
          </label>
          <input
            id="abs-from"
            type="date"
            min={today}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`${fieldBox} mt-[6px]`}
          />
        </div>
        <div>
          <label htmlFor="abs-to" className={label}>
            {t('absences.to')}
          </label>
          <input
            id="abs-to"
            type="date"
            min={from || today}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`${fieldBox} mt-[6px]`}
          />
        </div>
      </div>
      {datesSet && diffDays(from, to) >= 0 && (
        <p className="-mt-2 text-[11.5px] text-faint">
          {t('absences.workingDays', { count: days })}
        </p>
      )}

      <div>
        <label htmlFor="abs-deputy" className={label}>
          {t('absences.deputy')}
          <span className="text-brand-red"> *</span>
        </label>
        <select
          id="abs-deputy"
          value={deputyId}
          onChange={(e) => setDeputyId(e.target.value)}
          aria-invalid={tried && !deputy}
          data-invalid={tried && !deputy}
          className={`${fieldBox} mt-[6px]`}
        >
          <option value="">{t('absences.selectDeputy')}</option>
          {staff
            .filter((p) => p.id !== person.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <p className="mt-1 text-[11px] text-dim">{t('absences.deputyHint')}</p>
      </div>

      <div>
        <label htmlFor="abs-note" className={label}>
          {t('absences.note')}
        </label>
        <input
          id="abs-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t(`absences.notePlaceholder.${kind}`)}
          className={`${fieldBox} mt-[6px]`}
        />
      </div>

      {affected > 0 && deputy && (
        <p className="rounded-9 border border-info-line bg-info-chip px-3 py-2 text-[12px] text-info-text">
          {t('absences.affectedTasks', { count: affected, name: deputy.short })}
        </p>
      )}
      {shownProblems.map((p) => (
        <FieldError key={p.code} text={problemText(p)} />
      ))}

      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={onDone}>
          {t('documents.cancel')}
        </button>
        <button type="submit" className={primaryButton} disabled={create.isPending}>
          {t('absences.save')}
        </button>
      </div>
    </form>
  );
}

function CancelForm({ absence, onDone }: { absence: Absence; onDone: () => void }) {
  const { t } = useTranslation();
  const cancel = useCancelAbsence(me.short);
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const error = reason.trim().length < 5 ? t('absences.errorReason') : null;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!error) cancel.mutate({ id: absence.id, reason }, { onSuccess: onDone });
      }}
      className="mt-4 flex flex-col gap-3"
    >
      <p className="text-[12px] leading-[17px] text-faint">
        {t('absences.cancelHint', { name: absence.person.short, deputy: absence.deputy.short })}
      </p>
      <div>
        <label htmlFor="abs-reason" className={label}>
          {t('absences.reason')}
        </label>
        <textarea
          id="abs-reason"
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
        <button type="submit" className={primaryButton} disabled={cancel.isPending}>
          {t('absences.cancel')}
        </button>
      </div>
    </form>
  );
}
