import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@/shared/ui/icons';
import type { DocStatus } from './types';

/** Цвет метки статуса */
const statusTone: Record<DocStatus, string> = {
  draft: 'bg-muted-chip text-dim',
  registered: 'bg-warning-chip text-warning-text',
  inWork: 'bg-info-chip text-info-text',
  done: 'bg-success-chip text-success',
  sent: 'bg-success-chip text-success',
  signed: 'bg-success-chip text-success',
  annulled: 'bg-danger-chip text-danger',
};

export function StatusChip({ status }: { status: DocStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-[5px] px-[7px] text-[10.5px] font-medium ${statusTone[status]}`}
    >
      {t(`documents.status.${status}`)}
    </span>
  );
}

export const label = 'text-[10.5px] font-medium tracking-[0.2px] text-sub';
export const fieldBox =
  'flex min-h-[40px] w-full items-center gap-2 rounded-8 border border-line bg-column px-[12px] text-[12.5px] text-text outline-none focus-within:border-info focus:border-info data-[invalid=true]:border-danger';
export const primaryButton =
  'flex h-9 items-center gap-2 rounded-9 bg-brand-red px-4 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryButton =
  'flex h-9 items-center gap-2 rounded-9 border border-line bg-control px-4 text-[12.5px] font-medium text-sub hover:text-text disabled:opacity-50';
export const capsTitle = 'text-[10px] font-semibold uppercase tracking-[1.4px] text-dim';

/** Модальное окно формы: заголовок, содержимое, крестик */
export function FormDialog({
  open,
  title,
  onClose,
  children,
  width = 560,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          style={{ width: `min(${width}px, calc(100vw - 48px))` }}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-18 border border-line bg-panel px-6 pb-6 pt-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <Dialog.Title className="pr-10 text-[17px] font-semibold tracking-[-0.3px] text-text">
            {title}
          </Dialog.Title>
          {open && children}
          <Dialog.Close
            aria-label={t('taskCard.close')}
            className="absolute right-5 top-4 flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FieldError({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-1 text-[11px] text-danger">
      {text}
    </p>
  );
}
