import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCan, useCurrentPersonId } from '@/features/auth';
import { useChatMembers } from '@/features/chat/api';
import { PickerDialog, SearchBox } from '@/features/chat/dialogs';
import {
  FieldError,
  fieldBox,
  label,
  primaryButton,
  secondaryButton,
} from '@/features/documents/parts';
import { ApiError } from '@/shared/api/client';
import { errorText } from '@/shared/api/feedback';
import { formatIsoDate } from '@/shared/lib/date';
import type { IsoDate } from '@/shared/lib/workDays';
import { CheckTinyIcon } from '@/shared/ui/icons';
import { useCalendarConnection, useCreateEvent } from './events';

/**
 * Новое событие в календаре: название, день, время (или весь день), участники, место,
 * описание. Если Google Календарь подключён — по умолчанию уходит и туда, участникам придут
 * приглашения от Google. Проверки — на бэкенде (apps/events/services.py).
 */
export function EventDialog({
  open,
  day,
  onClose,
}: {
  open: boolean;
  day: IsoDate;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PickerDialog open={open} title={t('calendar.newEvent')} onClose={onClose}>
      <EventForm day={day} onDone={onClose} />
    </PickerDialog>
  );
}

function EventForm({ day, onDone }: { day: IsoDate; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const { can } = useCan();
  const me = useCurrentPersonId();
  const members = useChatMembers(can('chat.use'));
  const connection = useCalendarConnection().data;
  const googleReady = Boolean(connection?.connected && !connection.needsReconnect);
  const create = useCreateEvent();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<IsoDate>(day);
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [attendees, setAttendees] = useState<Set<string>>(new Set());
  const [google, setGoogle] = useState(true);
  const [query, setQuery] = useState('');

  const fields = create.error instanceof ApiError ? (create.error.fields ?? {}) : {};
  const fieldError = (key: string) => (fields[key] ? errorText(create.error, t) : null);
  const needle = query.trim().toLowerCase();
  const people = Object.values(members).filter(
    (m) =>
      m.id !== me &&
      m.active !== false &&
      (!needle || [m.name, m.department].some((v) => v.toLowerCase().includes(needle))),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        title: title.trim(),
        date,
        startTime: allDay ? null : start || null,
        endTime: allDay ? null : end || null,
        description: description.trim(),
        location: location.trim(),
        attendeeIds: [...attendees],
        google: googleReady && google,
      },
      { onSuccess: onDone },
    );
  };
  const toggle = (id: string) =>
    setAttendees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
    >
      <label className="block">
        <span className={label}>{t('calendar.eventTitle')}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          className={`${fieldBox} mt-[6px]`}
        />
        <FieldError text={fieldError('title')} />
      </label>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="block">
          <span className={label}>{t('calendar.eventDate')}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value as IsoDate)}
            className={`${fieldBox} mt-[6px]`}
          />
        </label>
        <label className="flex h-9 items-center gap-2 text-[12px] text-sub">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          {t('calendar.allDay')}
        </label>
      </div>
      <p className="-mt-2 text-[11px] text-dim">
        {formatIsoDate(date, 'EEEE, d MMMM', i18n.language)}
      </p>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>{t('calendar.eventStart')}</span>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={`${fieldBox} mt-[6px]`}
            />
            <FieldError text={fieldError('startTime')} />
          </label>
          <label className="block">
            <span className={label}>{t('calendar.eventEnd')}</span>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={`${fieldBox} mt-[6px]`}
            />
            <FieldError text={fieldError('endTime')} />
          </label>
        </div>
      )}
      <label className="block">
        <span className={label}>{t('calendar.eventLocation')}</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={500}
          className={`${fieldBox} mt-[6px]`}
        />
      </label>
      <label className="block">
        <span className={label}>{t('calendar.eventDescription')}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${fieldBox} mt-[6px] py-2`}
        />
      </label>
      {Object.keys(members).length > 0 && (
        <div>
          <span className={label}>
            {t('calendar.eventAttendees')} {attendees.size > 0 && `· ${attendees.size}`}
          </span>
          <div className="mt-[6px]">
            <SearchBox
              value={query}
              onChange={setQuery}
              label={t('calendar.eventAttendees')}
              autoFocus={false}
            />
          </div>
          <ul className="mt-2 max-h-[150px] overflow-y-auto">
            {people.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-[10px] rounded-9 px-2 py-[6px] hover:bg-row-highlight">
                  <input
                    type="checkbox"
                    checked={attendees.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border ${
                      attendees.has(m.id) ? 'border-info bg-info text-[#FFFFFF]' : 'border-line'
                    }`}
                  >
                    {attendees.has(m.id) && <CheckTinyIcon size={12} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-text">{m.name}</span>
                  <span className="truncate text-[10.5px] text-dim">{m.department}</span>
                </label>
              </li>
            ))}
          </ul>
          <FieldError text={fieldError('attendeeIds')} />
        </div>
      )}
      {googleReady ? (
        <label className="flex items-center gap-2 text-[12px] text-sub">
          <input type="checkbox" checked={google} onChange={(e) => setGoogle(e.target.checked)} />
          {t('calendar.toGoogle', { email: connection?.email })}
        </label>
      ) : (
        <p className="text-[11.5px] text-dim">{t('calendar.googleNotConnected')}</p>
      )}
      {create.isError && !Object.keys(fields).length && (
        <p role="alert" className="text-[11.5px] text-danger">
          {errorText(create.error, t)}
        </p>
      )}
      <div className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={onDone} className={secondaryButton}>
          {t('assistant.cancel')}
        </button>
        <button
          type="submit"
          disabled={!title.trim() || create.isPending}
          className={primaryButton}
        >
          {t('calendar.createEvent')}
        </button>
      </div>
    </form>
  );
}
