import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import type { StaffSession } from './api';

export function SessionList({
  list,
  canEnd,
  unavailable,
  pending,
  endAllLabel,
  sessionText,
  allText,
  onEnd,
}: {
  list: StaffSession[] | null | undefined;
  canEnd: boolean;
  unavailable: ReactNode;
  pending: boolean;
  endAllLabel: string;
  sessionText: (session: StaffSession) => string;
  allText: (count: number) => string;
  onEnd: (sessionId: string | null, done: () => void) => void;
}) {
  const { t, i18n } = useTranslation();
  const [ending, setEnding] = useState<StaffSession | 'all' | null>(null);
  const others = (list ?? []).filter((s) => !s.current);
  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bishkek',
    });

  return (
    <>
      {canEnd && others.length > 1 && (
        <button
          type="button"
          onClick={() => setEnding('all')}
          className="mt-1 text-[11.5px] font-medium text-danger hover:underline"
        >
          {endAllLabel}
        </button>
      )}
      {list === null ? (
        <p className="mt-2 text-[12px] text-dim">{unavailable}</p>
      ) : list === undefined ? null : list.length === 0 ? (
        <p className="mt-2 text-[12px] text-dim">{t('access.noDevices')}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {list.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-9 border border-line bg-column px-3 py-[9px]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] text-text">
                  {s.device}
                  {s.current && (
                    <span className="ml-2 text-[11px] text-success">
                      {t('access.currentSession')}
                    </span>
                  )}
                </p>
                <p className="mt-[2px] text-[11px] text-dim">
                  {t(`access.platform.${s.platform}`)} ·{' '}
                  {t('access.lastSeen', { time: when(s.lastSeenAt) })}
                </p>
              </div>
              {canEnd && !s.current && (
                <button
                  type="button"
                  onClick={() => setEnding(s)}
                  aria-label={`${t('access.endSession')}: ${s.device}`}
                  className="h-8 shrink-0 rounded-8 border border-line px-3 text-[11.5px] font-medium text-sub hover:border-danger-line hover:text-danger"
                >
                  {t('access.endSession')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={ending !== null}
        tone="danger"
        title={ending === 'all' ? t('access.endAllTitle') : t('access.endSessionTitle')}
        confirmLabel={ending === 'all' ? endAllLabel : t('access.endSession')}
        cancelLabel={t('access.cancel')}
        pending={pending}
        onCancel={() => setEnding(null)}
        onConfirm={() =>
          onEnd(ending === 'all' || !ending ? null : ending.id, () => setEnding(null))
        }
      >
        {ending === 'all' ? allText(others.length) : ending ? sessionText(ending) : ''}
      </ConfirmDialog>
    </>
  );
}
