import type { ButtonHTMLAttributes } from 'react';
import googleIcon from './assets/google.svg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

/** Кнопка входа через Google. В тёмной теме светлая, в светлой — тёмная (макет) */
export function GoogleButton({ loading = false, children, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      disabled={loading || rest.disabled}
      aria-busy={loading}
      className={`flex h-14 w-full items-center gap-3 rounded-12 bg-text px-[18px] text-left text-[15px] font-semibold tracking-[-0.1px] text-panel transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-default disabled:opacity-50 ${className}`}
      {...rest}
    >
      <img src={googleIcon} alt="" width={20} height={20} />
      <span className="ml-1 flex-1">{children}</span>
      {loading ? (
        <span
          className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent text-faint"
          aria-hidden
        />
      ) : (
        <span className="pr-1 font-medium text-faint" aria-hidden>
          →
        </span>
      )}
    </button>
  );
}
