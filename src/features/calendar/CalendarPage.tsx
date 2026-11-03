import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { useCan } from '@/features/auth';
import { Avatar } from '@/features/knowledge-base/parts';
import { mockAbsences } from '@/features/tasks/absences';
import { useTasks } from '@/features/tasks/api';
import { DueChips } from '@/features/tasks/board/TaskCard';
import { urgencyOf } from '@/features/tasks/deadline';
import { currentUserId } from '@/features/tasks/directory';
import type { Task } from '@/features/tasks/types';
import { years } from '@/shared/config/workCalendar';
import { formatIsoDate } from '@/shared/lib/date';
import { type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { ChevronLeftIcon, PlaneIcon } from '@/shared/ui/icons';
import {
  type CalendarLayer,
  calendarLayers,
  type DayEvents,
  dayType,
  eventsByDay,
  holidayRanges,
  isIsoMonth,
  monthGrid,
  monthNorm,
  monthOf,
  shiftMonth,
} from './month';

/** Сколько сроков видно в клетке дня; остальные — «ещё N» */
const CELL_DEADLINES = 2;

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

const isIsoDate = (v: string | null): v is IsoDate => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

const layerDot: Record<CalendarLayer, string> = {
  mine: 'bg-info',
  department: 'bg-faint',
  absences: 'bg-tone-cyan',
};

/**
 * Календарь: месяц по производственному календарю КР — праздники, выходные, сокращённые дни
 * и норма часов; сроки задач и отпуска по дням. Справа — выбранный день.
 * Месяц и день — в адресе (?m=2026-09&d=2026-09-09). Макета нет.
 */
export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const { can } = useCan();
  const canTasks = can('tasks.view');
  const today = todayInBishkek();
  const [params, setParams] = useSearchParams();
  const selected = isIsoDate(params.get('d')) ? (params.get('d') as IsoDate) : today;
  const month = isIsoMonth(params.get('m')) ? (params.get('m') as string) : monthOf(selected);
  const [layers, setLayers] = useState<Set<CalendarLayer>>(() => new Set(calendarLayers));
  const tasks = useTasks('department');

  const weeks = useMemo(() => monthGrid(month), [month]);
  const norm = useMemo(() => monthNorm(month), [month]);
  const absences = useMemo(() => mockAbsences(today), [today]);
  const shownLayers = useMemo(
    () => new Set([...layers].filter((l) => canTasks || l === 'absences')),
    [layers, canTasks],
  );
  const events = useMemo(
    () =>
      eventsByDay(
        [...weeks.flat(), selected],
        canTasks ? (tasks.data ?? []) : [],
        absences,
        shownLayers,
        currentUserId,
      ),
    [weeks, selected, tasks.data, absences, shownLayers, canTasks],
  );

  const monthTitle = capitalize(formatIsoDate(`${month}-01`, 'LLLL yyyy', i18n.language));
  usePageSubtitle(
    `${monthTitle} · ${t('calendar.norm', { count: norm.workingDays, hours: norm.hours })}`,
  );

  const go = (next: { m?: string; d?: IsoDate }) =>
    setParams(
      (p) => {
        if (next.m) p.set('m', next.m);
        if (next.d) p.set('d', next.d);
        return p;
      },
      { replace: true },
    );
  const pick = (day: IsoDate) => go({ d: day, m: monthOf(day) });
  const toggle = (layer: CalendarLayer) =>
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });

  const weekdays = weeks[0].map((d) => formatIsoDate(d, 'EEEEEE', i18n.language));

  return (
    <div className="flex h-full min-h-[600px] flex-col gap-3 leading-[normal]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('calendar.prev')}
            onClick={() => go({ m: shiftMonth(month, -1) })}
            className="flex size-8 items-center justify-center rounded-9 border border-line bg-control text-sub hover:text-text"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <h2
            aria-live="polite"
            className="min-w-[150px] text-center text-[15px] font-semibold tracking-[-0.2px] text-text"
          >
            {monthTitle}
          </h2>
          <button
            type="button"
            aria-label={t('calendar.next')}
            onClick={() => go({ m: shiftMonth(month, 1) })}
            className="flex size-8 items-center justify-center rounded-9 border border-line bg-control text-sub hover:text-text"
          >
            <ChevronLeftIcon size={16} className="rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => pick(today)}
            disabled={selected === today && month === monthOf(today)}
            className="ml-1 h-8 rounded-9 border border-line bg-control px-3 text-[12.5px] font-medium text-sub hover:text-text disabled:opacity-50"
          >
            {t('calendar.today')}
          </button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-[6px]">
          <legend className="sr-only">{t('calendar.layers')}</legend>
          {calendarLayers
            .filter((l) => canTasks || l === 'absences')
            .map((layer) => {
              const on = layers.has(layer);
              return (
                <button
                  key={layer}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(layer)}
                  className={`flex h-8 items-center gap-[7px] rounded-9 border px-3 text-[12px] ${
                    on
                      ? 'border-transparent bg-control-active font-medium text-text'
                      : 'border-line text-faint hover:text-text'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${on ? layerDot[layer] : 'bg-dim'}`}
                  />
                  {t(`calendar.layer.${layer}`)}
                </button>
              );
            })}
        </fieldset>
      </div>

      {!norm.official && (
        <p
          role="status"
          className="rounded-9 border border-warning-line bg-warning-soft px-4 py-2 text-[12px] text-warning-text"
        >
          {t('calendar.unofficial', { year: month.slice(0, 4) })}
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-[14px]">
        <section
          aria-label={monthTitle}
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-14 border border-line bg-panel"
        >
          <div className="grid grid-cols-7 border-b border-line">
            {weekdays.map((w, i) => (
              <div
                key={w}
                className={`px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[1px] ${
                  i >= 5 ? 'text-dim' : 'text-faint'
                }`}
              >
                {w}
              </div>
            ))}
          </div>
          <div
            className="grid flex-1 grid-cols-7"
            style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(96px, 1fr))` }}
          >
            {weeks.flat().map((day) => (
              <DayCell
                key={day}
                day={day}
                inMonth={monthOf(day) === month}
                today={day === today}
                selected={day === selected}
                events={events.get(day)}
                onPick={() => pick(day)}
              />
            ))}
          </div>
        </section>

        <DayPanel day={selected} events={events.get(selected)} month={month} norm={norm} />
      </div>
    </div>
  );
}

function DayCell({
  day,
  inMonth,
  today,
  selected,
  events,
  onPick,
}: {
  day: IsoDate;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  events: DayEvents | undefined;
  onPick: () => void;
}) {
  const { t, i18n } = useTranslation();
  const type = dayType(day);
  const off = type.type !== 'working';
  const deadlines = events?.deadlines ?? [];
  const absences = events?.absences ?? [];
  const more = deadlines.length - CELL_DEADLINES;
  const label = [
    formatIsoDate(day, 'EEEE, d MMMM', i18n.language),
    type.type === 'holiday' ? t(`holidays.${type.holiday}`) : null,
    deadlines.length ? t('calendar.deadlinesCount', { count: deadlines.length }) : null,
    absences.length ? t('calendar.absentCount', { count: absences.length }) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onPick}
      className={`relative flex min-w-0 flex-col gap-1 border-b border-r border-line p-[6px] text-left transition-colors [&:nth-child(7n)]:border-r-0 ${
        off ? 'bg-surface' : ''
      } ${selected ? 'outline outline-2 -outline-offset-2 outline-info' : 'hover:bg-row-highlight'} ${
        inMonth ? '' : 'opacity-45'
      }`}
    >
      <span className="flex items-center gap-[6px]">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] ${
            today
              ? 'bg-brand-red font-semibold text-[#FFFFFF]'
              : type.type === 'holiday'
                ? 'font-semibold text-danger'
                : off
                  ? 'text-dim'
                  : 'text-text'
          }`}
        >
          {Number(day.slice(8))}
        </span>
        {type.type === 'holiday' && (
          <span className="truncate text-[10px] font-medium text-danger">
            {t(`holidays.${type.holiday}`)}
          </span>
        )}
        {type.type === 'working' && type.shortened && (
          <span className="rounded-[4px] bg-warning-chip px-[5px] text-[9.5px] font-medium text-warning-text">
            {t('calendar.shortenedTag')}
          </span>
        )}
      </span>
      {deadlines.slice(0, CELL_DEADLINES).map((task) => (
        <span
          key={task.id}
          className={`truncate rounded-[5px] px-[6px] py-[2px] text-[10.5px] ${deadlineChip(task)}`}
        >
          {task.title}
        </span>
      ))}
      {more > 0 && (
        <span className="px-[6px] text-[10.5px] text-faint">
          {t('calendar.more', { count: more })}
        </span>
      )}
      {absences.length > 0 && (
        <span className="mt-auto flex items-center gap-[3px]">
          <PlaneIcon size={11} className="shrink-0 text-tone-cyan" />
          {absences.slice(0, 3).map((a) => (
            <Avatar key={a.person.id} person={a.person} size={20} />
          ))}
          {absences.length > 3 && (
            <span className="text-[10px] text-faint">+{absences.length - 3}</span>
          )}
        </span>
      )}
    </button>
  );
}

function deadlineChip(task: Task) {
  if (urgencyOf(task).urgency === 'overdue') return 'bg-danger-chip text-danger';
  if (task.assignee?.id === currentUserId) return 'bg-info-chip text-info-text';
  return 'bg-chip text-chip-text';
}

function DayPanel({
  day,
  events,
  month,
  norm,
}: {
  day: IsoDate;
  events: DayEvents | undefined;
  month: string;
  norm: ReturnType<typeof monthNorm>;
}) {
  const { t, i18n } = useTranslation();
  const type = dayType(day);
  const deadlines = events?.deadlines ?? [];
  const absences = events?.absences ?? [];
  const date = (d: IsoDate, pattern = 'd MMM') =>
    formatIsoDate(d, pattern, i18n.language).replace('.', '');
  const typeLabel =
    type.type === 'holiday'
      ? t(`holidays.${type.holiday}`)
      : type.type === 'weekend'
        ? t('dashboard.dayKind.weekend')
        : t(`dashboard.dayKind.${type.shortened ? 'shortened' : 'working'}`);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-y-auto rounded-14 border border-line bg-panel">
      <div className="border-b border-line px-5 pb-4 pt-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.2px] text-text">
          {capitalize(formatIsoDate(day, 'EEEE, d MMMM', i18n.language))}
        </h2>
        <p className={`mt-1 text-[12px] ${type.type === 'holiday' ? 'text-danger' : 'text-faint'}`}>
          {typeLabel}
          {type.type === 'working' &&
            ` · ${t('calendar.hours', { count: type.shortened ? 7 : 8 })}`}
        </p>
      </div>

      <PanelSection title={t('calendar.deadlines')} count={deadlines.length}>
        {deadlines.length === 0 ? (
          <Empty text={t('calendar.noDeadlines')} />
        ) : (
          <ul>
            {deadlines.map((task) => (
              <li key={task.id}>
                <Link
                  to={`/tasks?task=${task.id}`}
                  className="block px-5 py-[9px] hover:bg-row-highlight"
                >
                  <p className="text-[12.5px] leading-[17px] text-text">{task.title}</p>
                  <p className="mt-[5px] flex flex-wrap items-center gap-[5px] text-[11px] text-dim">
                    <DueChips task={task} />
                    {task.assignee && <span>{task.assignee.short}</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection title={t('calendar.absent')} count={absences.length}>
        {absences.length === 0 ? (
          <Empty text={t('dashboard.noAbsences')} />
        ) : (
          <ul>
            {absences.map((a) => (
              <li key={a.person.id} className="flex items-center gap-[10px] px-5 py-2">
                <Avatar person={a.person} size={24} />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] text-text">{a.person.name}</p>
                  <p className="truncate text-[11px] text-faint">
                    {t('dashboard.absentFrom', { from: date(a.from), to: date(a.to) })}
                    {' · '}
                    {t('dashboard.deputy', { name: a.deputy.short })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <div className="mt-auto border-t border-line px-5 py-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[1.4px] text-dim">
          {t('calendar.monthTitle', {
            month: formatIsoDate(`${month}-01`, 'LLLL', i18n.language),
          })}
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-y-1 text-[12px]">
          <dt className="text-faint">{t('calendar.workingDaysLabel')}</dt>
          <dd className="text-right text-text">{norm.workingDays}</dd>
          <dt className="text-faint">{t('calendar.hoursLabel')}</dt>
          <dd className="text-right text-text">{norm.hours}</dd>
        </dl>
        {norm.holidays.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-[11.5px]">
            {holidayRanges(norm.holidays).map((h) => (
              <li key={h.from} className="flex justify-between gap-2">
                <span className="truncate text-sub">{t(`holidays.${h.holiday}`)}</span>
                <span className="shrink-0 text-dim">
                  {h.from === h.to
                    ? date(h.from, 'd MMMM')
                    : `${Number(h.from.slice(8))}–${date(h.to, 'd MMMM')}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {norm.shortened.length > 0 && (
          <p className="mt-2 text-[11px] text-faint">
            {t('calendar.shortenedDays', {
              dates: norm.shortened.map((d) => date(d, 'd MMMM')).join(', '),
            })}
          </p>
        )}
        {norm.official && (
          <p className="mt-3 text-[10.5px] leading-[15px] text-dim">
            {t('calendar.source', { source: years[Number(month.slice(0, 4))]?.source })}
          </p>
        )}
      </div>
    </aside>
  );
}

function PanelSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line pb-2">
      <h3 className="flex items-baseline gap-2 px-5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[1.4px] text-dim">
        {title}
        <span className="text-[10.5px] font-medium normal-case tracking-normal">{count}</span>
      </h3>
      {children}
    </section>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="px-5 pb-3 pt-1 text-[12px] text-dim">{text}</p>
);
