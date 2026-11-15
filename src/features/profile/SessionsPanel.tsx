import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { capsTitle, secondaryButton } from '@/features/documents/parts';
import { formatInBishkek } from '@/shared/lib/date';
import { MonitorIcon, PhoneIcon } from '@/shared/ui/icons';
import {
  type LoginSession,
  useLoginSessions,
  useTerminateOtherSessions,
  useTerminateSession,
} from './sessions';

/** Активна в последние 5 минут — «сейчас в сети» */
const ACTIVE_MS = 5 * 60_000;

/**
 * Активные сессии (профиль): где выполнен вход — браузеры и мобильное приложение. Чужое или
 * забытое устройство можно завершить: там сразу понадобится войти заново, браузерные
 * уведомления на нём выключаются.
 */
export function SessionsPanel({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const sessions = useLoginSessions();
  const others = useTerminateOtherSessions();
  const [confirmAll, setConfirmAll] = useState(false);
  const list = sessions.data ?? [];
  const otherCount = list.filter((s) => !s.current).length;

  return (
    <section className={`rounded-14 border border-line bg-panel px-5 py-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={capsTitle}>{t('profile.sessions.title')}</h3>
        {sessions.data && (
          <span className="text-[11px] text-dim">
            {t('profile.sessions.count', { count: list.length })}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11.5px] leading-4 text-faint">{t('profile.sessions.hint')}</p>

      {sessions.isError ? (
        <p className="mt-3 text-[12.5px] text-danger">{t('profile.sessions.loadError')}</p>
      ) : !sessions.data ? (
        <p className="mt-3 text-[12.5px] text-dim">{t('profile.sessions.loading')}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {list.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ul>
      )}

      {otherCount > 0 &&
        (confirmAll ? (
          <div className="mt-3 rounded-9 border border-line px-3 py-[10px]">
            <p className="text-[12px] text-sub">
              {t('profile.sessions.confirmOthers', { count: otherCount })}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={others.isPending}
                onClick={() => others.mutateAsync().then(() => setConfirmAll(false))}
                className={`${secondaryButton} text-danger`}
              >
                {t('profile.sessions.terminateOthers')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAll(false)}
                className={secondaryButton}
              >
                {t('profile.sessions.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmAll(true)}
            className="mt-3 text-[12px] font-medium text-danger hover:opacity-90"
          >
            {t('profile.sessions.terminateOthers')}
          </button>
        ))}
    </section>
  );
}

function SessionRow({ session: s }: { session: LoginSession }) {
  const { t, i18n } = useTranslation();
  const terminate = useTerminateSession();
  const Icon = s.client === 'mobile' ? PhoneIcon : MonitorIcon;
  const online = Date.now() - Date.parse(s.lastSeenAt) < ACTIVE_MS;
  const when = (iso: string) => formatInBishkek(iso, 'd MMM, HH:mm', i18n.language);
  const device = s.device || t('profile.sessions.unknownDevice');

  return (
    <li className="flex items-start gap-3 rounded-9 border border-line px-3 py-[10px]">
      <span className="mt-[2px] flex size-7 shrink-0 items-center justify-center rounded-8 bg-control text-sub">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-text">
          {device}
          {s.current && (
            <span className="rounded-[5px] bg-info-chip px-[6px] py-[1px] text-[10.5px] font-medium text-info">
              {t('profile.sessions.current')}
            </span>
          )}
        </span>
        <span className="mt-[2px] block text-[11px] text-dim">
          {[
            s.ip,
            s.current || online
              ? t('profile.sessions.online')
              : t('profile.sessions.lastSeen', { date: when(s.lastSeenAt) }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className="block text-[10.5px] text-faint">
          {t('profile.sessions.signedIn', { date: when(s.createdAt) })}
        </span>
      </span>
      {!s.current && (
        <button
          type="button"
          disabled={terminate.isPending}
          onClick={() => terminate.mutate(s.id)}
          aria-label={`${t('profile.sessions.terminate')}: ${device}`}
          className="shrink-0 rounded-8 border border-line px-[10px] py-[5px] text-[11.5px] font-medium text-danger hover:bg-row-highlight disabled:opacity-50"
        >
          {t('profile.sessions.terminate')}
        </button>
      )}
    </li>
  );
}
