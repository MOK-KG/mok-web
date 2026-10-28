import * as Dialog from '@radix-ui/react-dialog';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth';
import { type RoleCode, roleCodes } from '@/shared/config/permissions';
import { CheckboxCheckIcon, CheckIcon, XIcon } from '@/shared/ui/icons';
import { useSectionAccess } from './api';
import type { KbSection } from './types';

/**
 * Доступ к разделу (право knowledge.edit): всем ролям или только выбранным. Остальные видят
 * раздел в списке, но не его статьи — так же, как «Правовую базу».
 */
export function AccessDialog({
  section,
  onClose,
}: {
  section: KbSection | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={section !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(460px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {section && <AccessForm section={section} onClose={onClose} />}
          <Dialog.Close
            aria-label={t('knowledge.cancel')}
            className="absolute right-[19px] top-[19px] flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AccessForm({ section, onClose }: { section: KbSection; onClose: () => void }) {
  const { t } = useTranslation();
  const myRoles = (useSession().data?.user.roles ?? []) as RoleCode[];
  const save = useSectionAccess();
  const [limited, setLimited] = useState(section.roles !== null);
  const [selected, setSelected] = useState<RoleCode[]>(section.roles ?? []);
  const [error, setError] = useState(false);
  // Сам себе закрывает раздел — предупредить: после сохранения статьи пропадут из списка
  const losesAccess = limited && !selected.some((r) => myRoles.includes(r));

  const toggle = (role: RoleCode) => {
    setError(false);
    setSelected((list) => (list.includes(role) ? list.filter((r) => r !== role) : [...list, role]));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (limited && selected.length === 0) {
      setError(true);
      return;
    }
    await save
      .mutateAsync({ id: section.id, roles: limited ? selected : null })
      .then(onClose)
      .catch(() => null);
  };

  const radio = (value: boolean, label: string, hint: string) => (
    <label className="flex cursor-pointer gap-[10px] rounded-9 border border-line px-[13px] py-[10px] has-[:checked]:border-info-line has-[:checked]:bg-nav-active">
      <input
        type="radio"
        name="kb-access"
        checked={limited === value}
        onChange={() => {
          setLimited(value);
          setError(false);
        }}
        className="mt-[2px] accent-info"
      />
      <span>
        <span className="block text-[12.5px] font-medium text-text">{label}</span>
        <span className="mt-[2px] block text-[11px] leading-4 text-dim">{hint}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="px-[23px] pb-[22px] pt-[21px]">
      <Dialog.Title className="pr-10 text-[17px] font-semibold tracking-[-0.3px] text-text">
        {t('knowledge.accessTitle', { name: section.name })}
      </Dialog.Title>
      <Dialog.Description className="mt-1 text-[11.5px] leading-4 text-faint">
        {t('knowledge.accessHint')}
      </Dialog.Description>

      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="sr-only">{t('knowledge.access')}</legend>
        {radio(false, t('knowledge.accessAll'), t('knowledge.accessAllHint'))}
        {radio(true, t('knowledge.accessSome'), t('knowledge.accessSomeHint'))}
      </fieldset>

      {limited && (
        <fieldset className="mt-3">
          <legend className="sr-only">{t('knowledge.accessSome')}</legend>
          <div className="grid grid-cols-3 gap-[6px]">
            {roleCodes.map((role) => {
              const checked = selected.includes(role);
              return (
                <label
                  key={role}
                  className={`flex h-9 cursor-pointer items-center gap-2 rounded-8 border px-[10px] text-[12px] ${
                    checked
                      ? 'border-info-line bg-nav-active text-text'
                      : 'border-line text-sub hover:text-text'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(role)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex size-[14px] shrink-0 items-center justify-center rounded-[4px] border ${
                      checked ? 'border-info bg-info text-[#FFFFFF]' : 'border-line'
                    }`}
                  >
                    {checked && <CheckboxCheckIcon size={10} />}
                  </span>
                  <span className="font-medium">{role}</span>
                  {role === 'R6' && (
                    <span className="truncate text-[10.5px] text-dim">
                      {t('knowledge.roleRecords')}
                    </span>
                  )}
                  {myRoles.includes(role) && (
                    <span className="ml-auto text-[10px] text-dim">{t('knowledge.myRole')}</span>
                  )}
                </label>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[11px] text-danger">
              {t('knowledge.errorAccessRoles')}
            </p>
          )}
          {losesAccess && selected.length > 0 && (
            <p role="alert" className="mt-2 text-[11px] leading-4 text-warning-text">
              {t('knowledge.accessLoseOwn')}
            </p>
          )}
        </fieldset>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 items-center rounded-9 border border-line px-3 text-[12.5px] font-medium text-sub hover:text-text"
        >
          {t('knowledge.cancel')}
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="flex h-8 items-center gap-[6px] rounded-9 bg-brand-red px-3 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90 disabled:opacity-60"
        >
          <CheckIcon size={14} />
          {t('knowledge.save')}
        </button>
      </div>
    </form>
  );
}
