import type { ReactNode } from 'react';

type Props = {
  tone: 'danger' | 'warning';
  title: ReactNode;
  children: ReactNode;
  /** Действие под разделителем, например «Обновить статус» */
  action?: ReactNode;
};

const tones = {
  danger: {
    box: 'bg-danger-soft border-danger-line',
    stripe: 'bg-brand-red',
    title: 'text-danger',
  },
  warning: {
    box: 'bg-warning-soft border-warning-line',
    stripe: 'bg-brand-gold',
    title: 'text-warning',
  },
} as const;

/** Баннер с цветной полосой слева: ошибка входа, ожидание активации */
export function Banner({ tone, title, children, action }: Props) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`relative overflow-hidden rounded-12 border px-5 py-[19px] ${t.box}`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${t.stripe}`} aria-hidden />
      <p className={`text-[13.5px] font-semibold tracking-[-0.1px] ${t.title}`}>{title}</p>
      <div className="mt-2 text-[12.5px] leading-5 text-sub">{children}</div>
      {action && <div className="mt-3 border-t border-line pt-[10px]">{action}</div>}
    </div>
  );
}
