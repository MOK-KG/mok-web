import { useTranslation } from 'react-i18next';
import { BellIcon } from '@/shared/ui/icons';
import { useWebPush } from './webPush';

/**
 * Переключатель «Уведомления в браузере» (профиль). Включение спрашивает разрешение браузера;
 * запрещённые в браузере включаются только в настройках сайта — показываем подсказку.
 */
export function BrowserPushToggle({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { state, isLoading, toggle } = useWebPush();
  const on = state === 'on';
  const blocked = state === 'unsupported' || state === 'unavailable' || state === 'denied';
  const hint =
    state && state !== 'on' && state !== 'off'
      ? t(`notifications.browser.${state}`)
      : t('notifications.browser.hint');

  return (
    <label
      className={`flex items-center gap-[10px] rounded-9 border border-line px-3 py-[9px] ${
        blocked || isLoading ? 'cursor-default' : 'cursor-pointer hover:bg-row-highlight'
      } ${className}`}
    >
      <span className="flex size-5 items-center justify-center text-info">
        <BellIcon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-text">{t('notifications.browser.title')}</span>
        <span
          className={`block text-[10.5px] ${state === 'denied' ? 'text-warning-text' : 'text-dim'}`}
        >
          {hint}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={on}
        checked={on}
        disabled={blocked || isLoading || toggle.isPending}
        onChange={(e) => toggle.mutate(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-info ${
          on ? 'bg-info' : 'bg-chip'
        } ${blocked ? 'opacity-60' : ''}`}
      >
        <span
          className={`absolute top-[2px] size-4 rounded-full bg-[#FFFFFF] transition-[left] ${
            on ? 'left-[18px]' : 'left-[2px]'
          }`}
        />
      </span>
    </label>
  );
}
