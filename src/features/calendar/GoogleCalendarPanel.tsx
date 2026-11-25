import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useCan } from '@/features/auth';
import { primaryButton, secondaryButton } from '@/features/documents/parts';
import { errorText } from '@/shared/api/feedback';
import { toast } from '@/shared/lib/toast';
import {
  calendarConnectResult,
  connectCalendar,
  useCalendarConnection,
  useDisconnectCalendar,
} from './events';

/**
 * Личный Google Календарь в профиле: подключить (Google OAuth, доступ к событиям), переподключить,
 * отключить. События из платформы и от ассистента уходят в подключённый календарь с
 * приглашениями участникам.
 */
export function GoogleCalendarPanel({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { can } = useCan();
  const connection = useCalendarConnection();
  const disconnect = useDisconnectCalendar();
  useConnectToast();
  if (!can('calendar.view')) return null;

  const returnTo = `${window.location.origin}/profile`;
  const c = connection.data;

  return (
    <section
      aria-label={t('profile.calendar.title')}
      className={`rounded-14 border border-line bg-panel px-5 py-4 ${className}`}
    >
      <h3 className="text-[10px] font-semibold uppercase tracking-[1.4px] text-dim">
        {t('profile.calendar.title')}
      </h3>
      <p className="mt-1 text-[11.5px] leading-4 text-faint">{t('profile.calendar.hint')}</p>
      {connection.isError ? (
        <p className="mt-3 text-[12px] text-dim">{errorText(connection.error, t)}</p>
      ) : !c ? null : c.connected ? (
        <>
          <p className="mt-3 text-[12.5px] text-text">
            {t('profile.calendar.connectedAs', { email: c.email })}
          </p>
          {c.needsReconnect && (
            <p role="alert" className="mt-2 text-[11.5px] text-warning-text">
              {t('profile.calendar.needsReconnect')}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => connectCalendar(returnTo)}
            >
              {t('profile.calendar.reconnect')}
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate()}
            >
              {t('profile.calendar.disconnect')}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className={`${primaryButton} mt-3`}
          onClick={() => connectCalendar(returnTo)}
        >
          {t('profile.calendar.connect')}
        </button>
      )}
    </section>
  );
}

/** Возврат из Google: тост и убрать ?calendar=… из адреса */
function useConnectToast() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const result = calendarConnectResult(params);
    if (!result) return;
    if (result.status === 'connected') toast.success(t('profile.calendar.connected'));
    else {
      toast.error(
        t(`profile.calendar.error.${result.reason}`, {
          defaultValue: t('profile.calendar.error.google_error'),
        }),
      );
    }
    const next = new URLSearchParams(params);
    for (const key of ['calendar', 'reason']) next.delete(key);
    setParams(next, { replace: true });
  }, [params, setParams, t]);
}
