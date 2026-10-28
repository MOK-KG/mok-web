import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ApiError } from '@/shared/api/errors';
import { type RoleCode, roleCodes } from '@/shared/config/permissions';
import { CheckIcon, ChevronSmallIcon, MailIcon, XIcon } from '@/shared/ui/icons';
import { EMAIL_DOMAIN, type StaffRow, useInvite } from './api';
import { RoleCodeChip } from './parts';

const schema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^\S+\s+\S+/, 'errorName'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v.endsWith(EMAIL_DOMAIN) && v.length > EMAIL_DOMAIN.length, 'errorDomain'),
  position: z.string().trim().min(2, 'errorPosition'),
  department: z.string().trim().min(2, 'errorDepartment'),
  role: z.enum(roleCodes),
});

type FormValues = z.infer<typeof schema>;

/**
 * Приглашение (право staff.manage). Учётная запись появляется только так — на адрес
 * @olympic.kg; до первого входа сотрудник в статусе «Приглашён».
 */
export function InviteDialog({
  open,
  vacancy,
  departments,
  onClose,
}: {
  open: boolean;
  /** Приглашение на вакансию: должность, департамент и роль уже заполнены */
  vacancy: StaffRow | null;
  departments: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-48px)] w-[min(520px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {open && <InviteForm vacancy={vacancy} departments={departments} onClose={onClose} />}
          <Dialog.Close
            aria-label={t('access.close')}
            className="absolute right-[19px] top-[19px] flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const label = 'block text-[10.5px] font-medium tracking-[0.2px] text-sub';
const field =
  'mt-[6px] h-[42px] w-full rounded-8 border border-line bg-column px-[13px] text-[12.5px] text-text outline-none placeholder:text-dim focus:border-info data-[invalid=true]:border-danger';

function InviteForm({
  vacancy,
  departments,
  onClose,
}: {
  vacancy: StaffRow | null;
  departments: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const invite = useInvite();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      position: vacancy?.position ?? '',
      department: vacancy?.department ?? '',
      role: vacancy?.role ?? 'R5',
    },
  });

  const submit = handleSubmit(async (v) => {
    try {
      await invite.mutateAsync({ ...v, vacancyId: vacancy?.id });
      onClose();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null;
      setError('email', {
        message:
          code === 'email_exists'
            ? 'errorExists'
            : code === 'email_domain'
              ? 'errorDomain'
              : 'errorInvite',
      });
    }
  });

  const error = (key?: string) =>
    key ? (
      <p role="alert" className="mt-1 text-[11px] text-danger">
        {t(`access.${key}`, { domain: EMAIL_DOMAIN })}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate className="px-[23px] pb-[22px] pt-[21px]">
      <Dialog.Title className="pr-10 text-[17px] font-semibold tracking-[-0.3px] text-text">
        {vacancy
          ? t('access.inviteToVacancyTitle', { position: vacancy.position })
          : t('access.inviteTitle')}
      </Dialog.Title>
      <Dialog.Description className="mt-1 text-[11.5px] leading-4 text-faint">
        {t('access.inviteHint', { domain: EMAIL_DOMAIN })}
      </Dialog.Description>

      <div className="mt-4 flex flex-col gap-[14px]">
        <label>
          <span className={label}>{t('access.name')}</span>
          <input
            {...register('name')}
            // biome-ignore lint/a11y/noAutofocus: окно открыто ради этой формы
            autoFocus
            data-invalid={!!errors.name}
            placeholder={t('access.namePlaceholder')}
            className={field}
          />
          {error(errors.name?.message)}
        </label>
        <label>
          <span className={label}>{t('access.email')}</span>
          <input
            {...register('email')}
            type="email"
            data-invalid={!!errors.email}
            placeholder={`name${EMAIL_DOMAIN}`}
            className={field}
          />
          {error(errors.email?.message)}
        </label>
        <div className="grid grid-cols-2 gap-[14px]">
          <label>
            <span className={label}>{t('access.position')}</span>
            <input
              {...register('position')}
              data-invalid={!!errors.position}
              placeholder={t('access.positionPlaceholder')}
              className={field}
            />
            {error(errors.position?.message)}
          </label>
          <label>
            <span className={label}>{t('access.department')}</span>
            <input
              {...register('department')}
              list="access-departments"
              data-invalid={!!errors.department}
              placeholder={t('access.departmentPlaceholder')}
              className={field}
            />
            <datalist id="access-departments">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            {error(errors.department?.message)}
          </label>
        </div>
        <div>
          <span id="invite-role" className={label}>
            {t('access.role')}
          </span>
          <Controller
            control={control}
            name="role"
            render={({ field: f }) => (
              <Select.Root value={f.value} onValueChange={(v) => f.onChange(v as RoleCode)}>
                <Select.Trigger
                  aria-labelledby="invite-role"
                  className={`${field} flex items-center gap-[10px] text-left`}
                >
                  <RoleCodeChip role={f.value} />
                  <span className="min-w-0 flex-1 truncate">{t(`access.roles.${f.value}`)}</span>
                  <ChevronSmallIcon size={14} className="text-faint" />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    position="popper"
                    sideOffset={6}
                    className="z-[60] max-h-72 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
                  >
                    <Select.Viewport>
                      {roleCodes.map((role) => (
                        <Select.Item
                          key={role}
                          value={role}
                          className="flex cursor-pointer items-center gap-[10px] rounded-[7px] px-[10px] py-[7px] outline-none data-[highlighted]:bg-popover-active data-[state=checked]:bg-popover-active"
                        >
                          <RoleCodeChip role={role} />
                          <span className="min-w-0 flex-1">
                            <Select.ItemText>
                              <span className="block text-[12.5px] font-medium text-text">
                                {t(`access.roles.${role}`)}
                              </span>
                            </Select.ItemText>
                            <span className="block truncate text-[10.5px] text-dim">
                              {t(`access.roleHints.${role}`)}
                            </span>
                          </span>
                          <Select.ItemIndicator className="text-brand-gold">
                            <CheckIcon size={14} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            )}
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 items-center rounded-9 border border-line px-3 text-[12.5px] font-medium text-sub hover:text-text"
        >
          {t('access.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-8 items-center gap-[6px] rounded-9 bg-brand-red px-3 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90 disabled:opacity-60"
        >
          <MailIcon size={14} />
          {t('access.sendInvite')}
        </button>
      </div>
    </form>
  );
}
