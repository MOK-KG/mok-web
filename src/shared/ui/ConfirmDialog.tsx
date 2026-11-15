import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'default' | 'danger';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  pending = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content
          role="alertdialog"
          className="fixed left-1/2 top-1/2 z-[80] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-14 border border-line bg-panel p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <Dialog.Title className="text-[16px] font-semibold tracking-[-0.3px] text-text">
            {title}
          </Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-[12.5px] leading-5 text-sub">{children}</div>
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex h-9 items-center rounded-9 border border-line px-4 text-[12.5px] font-medium text-sub hover:text-text"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              data-tone={tone}
              className="flex h-9 items-center rounded-9 bg-brand-red px-4 text-[12.5px] font-semibold text-[#FFFFFF] hover:opacity-90 disabled:opacity-60"
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
