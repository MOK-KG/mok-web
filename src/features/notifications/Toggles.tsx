import { useTranslation } from 'react-i18next';
import { notificationKinds as kindList, type NotificationSettings } from './api';
import { notificationKinds } from './parts';

/**
 * Переключатели видов уведомлений — в окне настроек и в профиле (S-27).
 * Эскалацию выключить нельзя: это правило платформы.
 */
export function NotificationToggles({
  value,
  onChange,
  className = '',
}: {
  value: NotificationSettings | null;
  onChange: (next: NotificationSettings) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <ul className={`flex flex-col gap-[6px] ${className}`}>
      {kindList.map((k) => {
        const locked = k === 'escalation';
        const on = locked || !!value?.[k];
        const { Icon, color } = notificationKinds[k];
        return (
          <li key={k}>
            <label
              className={`flex items-center gap-[10px] rounded-9 border border-line px-3 py-[9px] ${
                locked ? 'cursor-default' : 'cursor-pointer hover:bg-row-highlight'
              }`}
            >
              <span className={`flex size-5 items-center justify-center ${color}`}>
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-text">
                  {t(`notifications.kinds.${k}`)}
                </span>
                {locked && (
                  <span className="block text-[10.5px] text-dim">
                    {t('notifications.escalationLocked')}
                  </span>
                )}
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={on}
                checked={on}
                disabled={locked}
                onChange={(e) => value && onChange({ ...value, [k]: e.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-info ${
                  on ? 'bg-info' : 'bg-chip'
                } ${locked ? 'opacity-60' : ''}`}
              >
                <span
                  className={`absolute top-[2px] size-4 rounded-full bg-[#FFFFFF] transition-[left] ${
                    on ? 'left-[18px]' : 'left-[2px]'
                  }`}
                />
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
