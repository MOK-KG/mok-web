import * as Popover from '@radix-ui/react-popover';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { monthGrid, monthOf, shiftMonth } from '@/features/calendar/month';
import { formatIsoDate } from '@/shared/lib/date';
import {
  addDays,
  addWorkingDays,
  dayKind,
  diffDays,
  type IsoDate,
  nextWorkingDay,
  todayInBishkek,
} from '@/shared/lib/workDays';
import { CalendarMediumIcon, ChevronLeftIcon } from './icons';

type Props = {
  id?: string;
  value: IsoDate | '';
  onChange: (date: IsoDate) => void;
  min?: IsoDate;
  workingDaysOnly?: boolean;
  invalid?: boolean;
  placeholder?: string;
  className: string;
};

const WEEK_MONDAY: IsoDate = '2024-01-01';

export function DateField({
  id,
  value,
  onChange,
  min,
  workingDaysOnly = false,
  invalid = false,
  placeholder,
  className,
}: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const today = todayInBishkek();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value || today));
  const [focused, setFocused] = useState<IsoDate>(value || today);
  const grid = useRef<HTMLDivElement>(null);

  const disabled = (date: IsoDate) =>
    (min !== undefined && diffDays(min, date) < 0) ||
    (workingDaysOnly && dayKind(date).kind !== 'working');

  useEffect(() => {
    if (!open) return;
    const start = value || today;
    setMonth(monthOf(start));
    setFocused(start);
  }, [open, value, today]);

  useEffect(() => {
    if (!open) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  const pick = (date: IsoDate) => {
    if (disabled(date)) return;
    onChange(date);
    setOpen(false);
  };

  const move = (date: IsoDate) => {
    setFocused(date);
    if (monthOf(date) !== month) setMonth(monthOf(date));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in steps) {
      e.preventDefault();
      move(addDays(focused, steps[e.key]));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const next = shiftMonth(month, e.key === 'PageUp' ? -1 : 1);
      setMonth(next);
      setFocused(`${next}-01`);
    }
  };

  const quick = [
    { key: 'today', date: today },
    { key: 'tomorrow', date: addDays(today, 1) },
    { key: 'inTwoWorkingDays', date: addWorkingDays(today, 2) },
    { key: 'inAWeek', date: nextWorkingDay(addDays(today, 7)) },
  ].filter((q) => !disabled(q.date));

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    formatIsoDate(addDays(WEEK_MONDAY, i), 'EEEEEE', lang),
  );

  const dayLabel = (date: IsoDate) => {
    const kind = dayKind(date);
    const note =
      kind.kind === 'holiday'
        ? t(`holidays.${kind.holiday}`)
        : kind.kind === 'weekend'
          ? t('datePicker.weekend')
          : null;
    return [formatIsoDate(date, 'EEEE, d MMMM yyyy', lang), note].filter(Boolean).join(' · ');
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={invalid}
          data-invalid={invalid}
          className={`${className} text-left`}
        >
          <CalendarMediumIcon size={17} className="shrink-0 text-faint" />
          <span className={`flex-1 truncate ${value ? 'text-text' : 'text-dim'}`}>
            {value ? formatIsoDate(value, 'EEEEEE, d MMMM yyyy', lang) : placeholder}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[60] w-[292px] rounded-12 border border-line bg-popover p-3 shadow-[0_10px_32px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-center justify-between pb-2">
            <button
              type="button"
              aria-label={t('datePicker.prevMonth')}
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="flex size-7 items-center justify-center rounded-[7px] text-faint hover:bg-row-highlight hover:text-text"
            >
              <ChevronLeftIcon size={15} />
            </button>
            <p
              aria-live="polite"
              className="text-[13px] font-semibold capitalize tracking-[-0.2px] text-text"
            >
              {formatIsoDate(`${month}-01`, 'LLLL yyyy', lang)}
            </p>
            <button
              type="button"
              aria-label={t('datePicker.nextMonth')}
              onClick={() => setMonth(shiftMonth(month, 1))}
              className="flex size-7 items-center justify-center rounded-[7px] text-faint hover:bg-row-highlight hover:text-text"
            >
              <ChevronLeftIcon size={15} className="rotate-180" />
            </button>
          </div>

          <div className="grid grid-cols-7 pb-1">
            {weekdays.map((w, i) => (
              <span
                key={w}
                className={`text-center text-[10.5px] font-medium uppercase tracking-[0.4px] ${
                  i >= 5 ? 'text-danger' : 'text-dim'
                }`}
              >
                {w}
              </span>
            ))}
          </div>

          <div ref={grid} className="grid grid-cols-7 gap-y-[2px]">
            {monthGrid(month)
              .flat()
              .map((date) => {
                const kind = dayKind(date).kind;
                const outside = monthOf(date) !== month;
                const off = disabled(date);
                const selected = date === value;
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    data-date={date}
                    tabIndex={date === focused ? 0 : -1}
                    disabled={off}
                    aria-label={dayLabel(date)}
                    aria-pressed={selected}
                    title={kind === 'holiday' ? dayLabel(date) : undefined}
                    onClick={() => pick(date)}
                    onFocus={() => setFocused(date)}
                    onKeyDown={onKeyDown}
                    className={`mx-auto flex size-9 items-center justify-center rounded-full text-[12.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-info ${
                      selected
                        ? 'bg-brand-red font-semibold text-[#FFFFFF]'
                        : off
                          ? 'cursor-not-allowed text-dim opacity-40'
                          : kind !== 'working'
                            ? 'text-danger hover:bg-row-highlight'
                            : 'text-text hover:bg-row-highlight'
                    } ${outside && !selected ? 'opacity-40' : ''} ${
                      isToday && !selected ? 'ring-1 ring-inset ring-info' : ''
                    } ${kind === 'holiday' && !selected ? 'underline decoration-dotted underline-offset-4' : ''}`}
                  >
                    {Number(date.slice(8))}
                  </button>
                );
              })}
          </div>

          {quick.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-[6px] border-t border-line pt-3">
              {quick.map((q) => (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => pick(q.date)}
                  className={`h-7 rounded-[7px] border px-[10px] text-[11.5px] font-medium ${
                    q.date === value
                      ? 'border-info bg-popover-active text-text'
                      : 'border-line text-sub hover:text-text'
                  }`}
                >
                  {t(`datePicker.${q.key}`)}
                </button>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
