import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { type Toast, type ToastTone, toast as toastApi, useToasts } from '@/shared/lib/toast';
import { AlertMiniIcon, BellSmallIcon, CheckSmallIcon, XIcon } from './icons';

const tones: Record<
  ToastTone,
  { Icon: ComponentType<{ size?: number; className?: string }>; stripe: string; color: string }
> = {
  success: { Icon: CheckSmallIcon, stripe: 'bg-success', color: 'text-success' },
  error: { Icon: AlertMiniIcon, stripe: 'bg-brand-red', color: 'text-danger' },
  warning: { Icon: AlertMiniIcon, stripe: 'bg-warning', color: 'text-warning' },
  info: { Icon: BellSmallIcon, stripe: 'bg-info', color: 'text-info' },
};

/**
 * Тосты в правом нижнем углу. Подключён один раз в AppProviders; показывать — через
 * toast.success(...) / toast.error(...) из shared/lib/toast или meta мутации.
 */
export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToasts();
  return (
    <section
      aria-label={t('toast.region')}
      className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2"
    >
      {toasts.map((item) => (
        <ToastItem key={item.id} toast={item} />
      ))}
    </section>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const { t } = useTranslation();
  const tone = tones[toast.tone];
  return (
    <div
      // Ошибку объявляем сразу (alert), остальное — когда экранный диктор освободится
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="toast-enter pointer-events-auto relative flex items-start gap-[10px] overflow-hidden rounded-12 border border-line bg-popover py-3 pl-[15px] pr-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${tone.stripe}`} />
      <tone.Icon size={16} className={`mt-px shrink-0 ${tone.color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium leading-[18px] tracking-[-0.1px] text-text">
          {toast.title}
        </p>
        {toast.text && <p className="mt-[2px] text-[11px] leading-4 text-faint">{toast.text}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onPress();
              toastApi.dismiss(toast.id);
            }}
            className="mt-[6px] text-[12px] font-semibold text-info hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label={t('toast.close')}
        onClick={() => toastApi.dismiss(toast.id)}
        className="flex size-6 shrink-0 items-center justify-center rounded-6 text-faint hover:bg-row-highlight hover:text-text"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
