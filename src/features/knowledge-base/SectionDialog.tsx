import * as Dialog from '@radix-ui/react-dialog';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/shared/api/errors';
import { CheckIcon, XIcon } from '@/shared/ui/icons';
import { SECTION_NAME_MAX, SECTION_NAME_MIN, useCreateSection, useRenameSection } from './api';
import type { KbSection } from './types';

/**
 * Окно «Новый раздел» (из редактора статьи и из списка разделов) или «Переименовать раздел»,
 * если передан section. Право knowledge.edit.
 */
export function SectionDialog({
  open,
  section,
  onClose,
  onCreated,
}: {
  open: boolean;
  section?: KbSection;
  onClose: () => void;
  onCreated: (section: KbSection) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {/* Форма монтируется заново при каждом открытии — поле и ошибка начинаются пустыми */}
          {open && <SectionForm section={section} onClose={onClose} onCreated={onCreated} />}
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

function SectionForm({
  section,
  onClose,
  onCreated,
}: {
  section?: KbSection;
  onClose: () => void;
  onCreated: (section: KbSection) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateSection();
  const rename = useRenameSection();
  const pending = create.isPending || rename.isPending;
  const [name, setName] = useState(section?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clean = name.trim();
    if (clean.length < SECTION_NAME_MIN || clean.length > SECTION_NAME_MAX) {
      setError(t('knowledge.errorSectionName', { min: SECTION_NAME_MIN, max: SECTION_NAME_MAX }));
      return;
    }
    try {
      if (section && clean === section.name) return onClose();
      const result = section
        ? await rename.mutateAsync({ id: section.id, name: clean })
        : await create.mutateAsync(clean);
      onCreated(result);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'section_exists'
          ? t('knowledge.errorSectionExists', { name: clean })
          : t(section ? 'knowledge.sectionRenameError' : 'knowledge.sectionCreateError'),
      );
    }
  };

  return (
    // Окно открывается и из формы статьи: React всплывает через портал, поэтому stopPropagation
    <form onSubmit={submit} noValidate className="px-[23px] pb-[22px] pt-[21px]">
      <Dialog.Title className="pr-10 text-[17px] font-semibold tracking-[-0.3px] text-text">
        {section ? t('knowledge.renameSection') : t('knowledge.newSection')}
      </Dialog.Title>
      <Dialog.Description className="mt-1 text-[11.5px] leading-4 text-faint">
        {section ? t('knowledge.renameSectionHint') : t('knowledge.newSectionHint')}
      </Dialog.Description>

      <label className="mt-4 block">
        <span className="block text-[10.5px] font-medium tracking-[0.2px] text-sub">
          {t('knowledge.sectionName')}
        </span>
        <input
          // biome-ignore lint/a11y/noAutofocus: окно открыто ради этого поля
          autoFocus
          value={name}
          maxLength={SECTION_NAME_MAX + 20}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          data-invalid={!!error}
          aria-invalid={!!error}
          placeholder={t('knowledge.sectionNamePlaceholder')}
          className="mt-[6px] h-[42px] w-full rounded-8 border border-line bg-column px-[13px] text-[12.5px] text-text outline-none placeholder:text-dim focus:border-info data-[invalid=true]:border-danger"
        />
      </label>
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
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
          disabled={pending}
          className="flex h-8 items-center gap-[6px] rounded-9 bg-brand-red px-3 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90 disabled:opacity-60"
        >
          <CheckIcon size={14} />
          {section ? t('knowledge.save') : t('knowledge.createSection')}
        </button>
      </div>
    </form>
  );
}
