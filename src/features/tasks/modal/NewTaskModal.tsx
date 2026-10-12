import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { type DragEvent, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSession } from '@/features/auth';
import { formatIsoDate } from '@/shared/lib/date';
import { initials } from '@/shared/lib/text';
import { dayKind, diffDays, todayInBishkek } from '@/shared/lib/workDays';
import {
  ArrowSmallIcon,
  AttachLargeIcon,
  CalendarMediumIcon,
  CheckIcon,
  ChevronSmallIcon,
  DuplicateIcon,
  PlaneMediumIcon,
  PlusMediumIcon,
  XIcon,
} from '@/shared/ui/icons';
import { absenceOf } from '../absences';
import { defaultDue, findSimilar, useCreateTask } from '../api';
import { people, projects } from '../directory';
import type { Person, Task } from '../types';
import { toneClasses } from '../ui';

const priorities = ['low', 'normal', 'high'] as const;

const schema = z
  .object({
    title: z.string().trim().min(3, 'errorTitle'),
    description: z.string(),
    assigneeId: z.string().min(1, 'errorAssignee'),
    due: z.string().min(1, 'errorDue'),
    projectId: z.string(),
    priority: z.enum(priorities),
  })
  .superRefine((v, ctx) => {
    if (!v.due) return;
    if (diffDays(todayInBishkek(), v.due) < 0) {
      ctx.addIssue({ code: 'custom', path: ['due'], message: 'errorDuePast' });
      return;
    }
    // Срок — только рабочий день по производственному календарю КР
    const kind = dayKind(v.due);
    if (kind.kind === 'holiday') {
      ctx.addIssue({ code: 'custom', path: ['due'], message: `errorDueHoliday|${kind.holiday}` });
    } else if (kind.kind === 'weekend') {
      ctx.addIssue({ code: 'custom', path: ['due'], message: 'errorDueWeekend' });
    }
  });

type FormValues = z.infer<typeof schema>;

const staff: Person[] = [people.ad, people.nb, people.dt, people.ka, people.me];
const projectList = Object.values(projects);

const label = 'text-[10.5px] font-medium tracking-[0.2px] text-sub';
const fieldBox =
  'flex h-[42px] w-full items-center gap-2 rounded-8 border border-line bg-column px-[13px] text-[12.5px] text-text outline-none focus-within:border-info focus:border-info data-[invalid=true]:border-danger';

function Required() {
  const { t } = useTranslation();
  return (
    <span className="text-brand-red" title={t('newTask.required')}>
      {' '}
      *
    </span>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Открыть задачу (похожую или только что созданную) */
  onOpenTask: (id: string) => void;
};

/** Окно «Новая задача» (макет Figma). Дубли и отпуск предупреждают, но не блокируют создание */
export function NewTaskModal({ open, onClose, onOpenTask }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-48px)] w-[min(760px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          {open && <NewTaskForm onClose={onClose} onOpenTask={onOpenTask} />}
          <Dialog.Close
            aria-label={t('taskCard.close')}
            className="absolute right-[27px] top-[23px] flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function NewTaskForm({ onClose, onOpenTask }: Omit<Props, 'open'>) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const department = useSession().data?.user.department;
  const create = useCreateTask();
  const [files, setFiles] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      assigneeId: '',
      due: defaultDue(),
      projectId: '',
      priority: 'normal',
    },
  });
  const { register, control, handleSubmit, watch, formState } = form;
  const errors = formState.errors;
  const title = watch('title');
  const due = watch('due');
  const assignee = staff.find((p) => p.id === watch('assigneeId'));

  const similar = title.trim().length >= 6 ? findSimilar(title) : [];
  const absence = absenceOf(assignee?.id);

  const errorText = (message?: string) => {
    if (!message) return null;
    const [key, holiday] = message.split('|');
    return t(`newTask.${key}`, { name: holiday ? t(`holidays.${holiday}`) : '' });
  };

  const onSubmit = handleSubmit(async (v) => {
    const task = await create.mutateAsync({
      title: v.title.trim(),
      description: v.description.trim(),
      assignee: staff.find((p) => p.id === v.assigneeId) as Person,
      due: v.due,
      project: projectList.find((p) => p.id === v.projectId) ?? null,
      priority: v.priority,
      attachments: files.length,
    });
    onClose();
    onOpenTask(task.id);
  });

  const addFiles = (list: FileList | null) =>
    list && setFiles((f) => [...f, ...Array.from(list, (file) => file.name)]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
      <header className="border-b border-line px-[27px] pb-[14px] pt-[25px]">
        <Dialog.Title className="text-[18px] font-semibold tracking-[-0.35px] text-text">
          {t('newTask.title')}
        </Dialog.Title>
        {department && <p className="mt-[2px] text-[12px] text-faint">{department}</p>}
      </header>

      <div className="flex min-h-0 flex-col gap-[18px] overflow-y-auto px-[27px] py-[18px]">
        <div>
          <label htmlFor="nt-title" className={label}>
            {t('newTask.name')}
            <Required />
          </label>
          <input
            id="nt-title"
            {...register('title')}
            data-invalid={!!errors.title}
            aria-invalid={!!errors.title}
            placeholder={t('newTask.namePlaceholder')}
            className={`${fieldBox} mt-[6px] placeholder:text-dim`}
          />
          {errors.title && (
            <p className="mt-1 text-[11px] text-danger">{errorText(errors.title.message)}</p>
          )}
          {similar.length > 0 && (
            <div
              role="status"
              className="relative mt-3 flex items-center gap-[10px] overflow-hidden rounded-9 border border-warning-line bg-warning-soft py-2 pl-[13px] pr-[14px]"
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-[2.5px] bg-warning" />
              <DuplicateIcon size={16} className="mt-[2px] shrink-0 self-start text-warning-text" />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold tracking-[-0.1px] text-warning-text">
                  {t('newTask.duplicatesTitle')}
                </p>
                {similar.map((task: Task) => (
                  <p key={task.id} className="truncate text-[10.5px] text-sub">
                    {t('newTask.duplicateLine', {
                      title: task.title,
                      status: t(`tasks.status.${task.status}`).toLocaleLowerCase(lang),
                    })}
                  </p>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTask(similar[0].id);
                }}
                className="flex h-6 shrink-0 items-center gap-1 rounded-6 border border-warning-line px-[10px] text-[10.5px] font-medium text-warning-text hover:opacity-90"
              >
                {t('newTask.open')}
                <ArrowSmallIcon size={13} />
              </button>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="nt-description" className={label}>
            {t('newTask.description')}
          </label>
          <textarea
            id="nt-description"
            rows={3}
            {...register('description')}
            placeholder={t('newTask.descriptionPlaceholder')}
            className={`${fieldBox} mt-[6px] h-auto resize-none py-3 leading-[18px] placeholder:text-dim`}
          />
        </div>

        <div className="grid grid-cols-2 gap-[14px]">
          <div>
            <span id="nt-assignee-label" className={label}>
              {t('newTask.assignee')}
              <Required />
            </span>
            <Controller
              control={control}
              name="assigneeId"
              render={({ field }) => (
                <Select.Root value={field.value} onValueChange={field.onChange}>
                  <Select.Trigger
                    aria-labelledby="nt-assignee-label"
                    data-invalid={!!errors.assigneeId}
                    className={`${fieldBox} mt-[6px] px-[11px]`}
                  >
                    {assignee ? (
                      <PersonOption person={assignee} />
                    ) : (
                      <span className="text-dim">{t('newTask.selectAssignee')}</span>
                    )}
                    <ChevronSmallIcon size={14} className="ml-auto text-faint" />
                  </Select.Trigger>
                  <SelectContent>
                    {staff.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <PersonOption person={p} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select.Root>
              )}
            />
            {errors.assigneeId && (
              <p className="mt-1 text-[11px] text-danger">{errorText(errors.assigneeId.message)}</p>
            )}
          </div>
          <div>
            <label htmlFor="nt-due" className={label}>
              {t('newTask.due')}
              <Required />
            </label>
            <div className={`${fieldBox} mt-[6px] px-[11px]`} data-invalid={!!errors.due}>
              <CalendarMediumIcon size={17} className="shrink-0 text-faint" />
              <input
                id="nt-due"
                type="date"
                min={todayInBishkek()}
                {...register('due')}
                aria-invalid={!!errors.due}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-text outline-none [color-scheme:dark] [[data-theme=light]_&]:[color-scheme:light]"
              />
            </div>
            {errors.due ? (
              <p className="mt-1 text-[11px] text-danger">{errorText(errors.due.message)}</p>
            ) : (
              due && (
                <p className="mt-1 text-[11px] text-faint">
                  {formatIsoDate(due, 'EEEE, d MMMM yyyy', lang)}
                </p>
              )
            )}
          </div>
        </div>

        {absence && assignee && (
          <div
            role="status"
            className="-mt-2 flex gap-[9px] rounded-8 border border-info-line bg-info-chip px-[13px] py-2"
          >
            <PlaneMediumIcon size={15} className="mt-[2px] shrink-0 text-info-text" />
            <div>
              <p className="text-[11px] font-semibold tracking-[-0.1px] text-info-text">
                {t('newTask.absenceTitle', {
                  from: formatIsoDate(absence.from, 'd', lang),
                  to: formatIsoDate(absence.to, 'd MMMM', lang),
                  name: absence.deputy.short,
                })}
              </p>
              {due && (
                <p className="text-[10.5px] text-sub">
                  {t(
                    diffDays(due, absence.from) > 0
                      ? 'newTask.absenceBefore'
                      : 'newTask.absenceDuring',
                    {
                      due: formatIsoDate(due, 'd MMMM', lang),
                    },
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-[14px]">
          <div>
            <span id="nt-project-label" className={label}>
              {t('newTask.project')}
            </span>
            <Controller
              control={control}
              name="projectId"
              render={({ field }) => (
                <Select.Root
                  value={field.value || 'none'}
                  onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                >
                  <Select.Trigger
                    aria-labelledby="nt-project-label"
                    className={`${fieldBox} mt-[6px]`}
                  >
                    <Select.Value />
                    <ChevronSmallIcon size={14} className="ml-auto text-faint" />
                  </Select.Trigger>
                  <SelectContent>
                    <SelectItem value="none">{t('newTask.noProject')}</SelectItem>
                    {projectList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={`size-[6px] rounded-full ${toneClasses[p.tone].dot}`}
                          />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select.Root>
              )}
            />
          </div>
          <fieldset>
            <legend className={label}>{t('newTask.priority')}</legend>
            <div className="mt-[6px] flex gap-[7px]">
              {priorities.map((p) => (
                <label key={p} className="cursor-pointer">
                  <input
                    type="radio"
                    value={p}
                    {...register('priority')}
                    className="peer sr-only"
                  />
                  <span className="flex h-[42px] items-center rounded-8 border border-line bg-column px-[11px] text-[12px] text-faint peer-checked:border-info peer-checked:bg-popover-active peer-checked:font-medium peer-checked:text-text peer-focus-visible:ring-2 peer-focus-visible:ring-info">
                    {t(`taskCard.priorityValue.${p}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <span className={label}>{t('newTask.attachments')}</span>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="mt-[6px] flex h-11 w-full items-center gap-[7px] rounded-8 border border-dashed border-line px-[13px] text-left text-[12px] text-dim hover:border-info hover:text-sub"
          >
            <AttachLargeIcon size={17} className="shrink-0" />
            {files.length > 0
              ? t('newTask.attached', { count: files.length })
              : t('newTask.attachHint')}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
          {files.length > 0 && (
            <p className="mt-1 truncate text-[11px] text-faint">{files.join(', ')}</p>
          )}
        </div>
      </div>

      <footer className="flex items-center gap-3 border-t border-line px-[27px] py-[18px]">
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="flex h-[42px] items-center gap-2 rounded-9 bg-brand-red px-4 text-[13px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90 disabled:opacity-60"
        >
          <PlusMediumIcon size={17} />
          {t('newTask.create')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-[42px] rounded-9 border border-line px-7 text-[13px] font-medium tracking-[-0.1px] text-sub hover:text-text"
        >
          {t('newTask.cancel')}
        </button>
        <p className="ml-auto max-w-[224px] text-[10.5px] text-dim">{t('newTask.hint')}</p>
      </footer>
    </form>
  );
}

function PersonOption({ person }: { person: Person }) {
  const tone = toneClasses[person.tone];
  return (
    <span className="flex items-center gap-2">
      <span
        className={`flex size-5 items-center justify-center rounded-full text-[8.5px] font-semibold ${tone.bg} ${tone.text}`}
      >
        {initials(person.name)}
      </span>
      {person.short}
    </span>
  );
}

function SelectContent({ children }: { children: React.ReactNode }) {
  return (
    <Select.Portal>
      <Select.Content
        position="popper"
        sideOffset={6}
        className="z-[60] max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
      >
        <Select.Viewport>{children}</Select.Viewport>
      </Select.Content>
    </Select.Portal>
  );
}

function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Select.Item
      value={value}
      className="flex h-[34px] cursor-pointer items-center gap-2 rounded-[7px] px-3 text-[12px] text-sub outline-none data-[highlighted]:bg-popover-active data-[state=checked]:bg-popover-active data-[highlighted]:text-text data-[state=checked]:text-text"
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="ml-auto text-brand-gold">
        <CheckIcon size={14} />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
