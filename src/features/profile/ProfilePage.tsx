import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { type ThemeMode, useTheme } from '@/app/providers/ThemeProvider';
import { useCurrentAbsences } from '@/features/absences/api';
import { useSession, useSignOut } from '@/features/auth';
import { primaryButton, secondaryButton } from '@/features/documents/parts';
import {
  type NotificationSettings,
  useNotificationSettings,
  useSaveNotificationSettings,
} from '@/features/notifications/api';
import { NotificationToggles } from '@/features/notifications/Toggles';
import { currentUserId } from '@/features/tasks/directory';
import { type Language, languageLabels, languages } from '@/shared/config/i18n';
import type { RoleCode } from '@/shared/config/permissions';
import { formatIsoDate } from '@/shared/lib/date';
import { initials } from '@/shared/lib/text';
import { LogoutIcon, PlaneIcon } from '@/shared/ui/icons';

const panel = 'rounded-14 border border-line bg-panel px-5 py-4';
const caps = 'text-[10px] font-semibold uppercase tracking-[1.4px] text-dim';

/**
 * Профиль и уведомления (S-27): кто я и какая у меня роль, язык и тема интерфейса,
 * какие уведомления получать (эскалацию выключить нельзя), мои отсутствия, выход.
 */
export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const user = useSession().data?.user;
  const signOut = useSignOut();
  const { mode, setMode } = useTheme();
  const settings = useNotificationSettings().data;
  const save = useSaveNotificationSettings();
  const [draft, setDraft] = useState<NotificationSettings | null>(null);
  const absences = (useCurrentAbsences().data ?? []).filter(
    (a) => a.person.id === currentUserId || a.deputy.id === currentUserId,
  );
  const current = (i18n.resolvedLanguage ?? 'ru') as Language;

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);
  usePageSubtitle(user?.email);

  if (!user) return null;
  const role = user.roles[0] as RoleCode | undefined;
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const date = (d: string) => formatIsoDate(d, 'd MMM', i18n.language).replace('.', '');
  const choice = (on: boolean) =>
    `h-8 flex-1 rounded-[7px] text-[12px] ${on ? 'bg-control-active font-semibold text-text' : 'text-sub hover:text-text'}`;

  return (
    <div className="grid gap-[14px] pb-4 leading-[normal] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-[14px]">
        <section className={`${panel} flex items-center gap-4`}>
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-control text-[18px] font-semibold text-info">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.3px] text-text">{user.name}</h2>
            <p className="mt-[2px] text-[12.5px] text-sub">
              {[user.position, user.department].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-[2px] text-[12px] text-faint">{user.email}</p>
          </div>
        </section>

        <section className={panel}>
          <h3 className={caps}>{t('profile.role')}</h3>
          {role ? (
            <>
              <p className="mt-2 text-[13px] text-text">
                <span className="mr-2 rounded-[5px] border border-line px-[6px] py-[1px] text-[11px] font-semibold text-sub">
                  {role}
                </span>
                {t(`access.roles.${role}`)}
              </p>
              <p className="mt-1 text-[12px] text-faint">{t(`access.roleHints.${role}`)}</p>
            </>
          ) : (
            <p className="mt-2 text-[12.5px] text-dim">—</p>
          )}
          <p className="mt-2 text-[11px] leading-4 text-dim">{t('profile.roleNote')}</p>
        </section>

        <section className={panel}>
          <h3 className={caps}>{t('profile.interface')}</h3>
          <p className="mt-3 text-[12px] text-sub">{t('shell.language')}</p>
          <div className="mt-[6px] flex gap-1 rounded-9 border border-line bg-control p-[3px]">
            {languages.map((lng) => (
              <button
                key={lng}
                type="button"
                aria-pressed={current === lng}
                onClick={() => i18n.changeLanguage(lng)}
                className={choice(current === lng)}
              >
                {languageLabels[lng]}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-sub">{t('shell.theme')}</p>
          <div className="mt-[6px] flex gap-1 rounded-9 border border-line bg-control p-[3px]">
            {(
              [
                ['dark', t('settings.dark')],
                ['light', t('settings.light')],
                ['system', t('shell.themeSystem')],
              ] as [ThemeMode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={choice(mode === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={caps}>{t('absences.title')}</h3>
            <Link to="/absences" className="text-[12px] font-medium text-info hover:underline">
              {t('absences.new')}
            </Link>
          </div>
          {absences.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-dim">{t('profile.noAbsences')}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {absences.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-[12.5px] text-sub">
                  <PlaneIcon size={12} className="shrink-0 text-info" />
                  {a.person.id === currentUserId
                    ? t('profile.myAbsence', {
                        kind: t(`absences.kind.${a.kind}`),
                        from: date(a.from),
                        to: date(a.to),
                        deputy: a.deputy.short,
                      })
                    : t('profile.covering', {
                        name: a.person.short,
                        from: date(a.from),
                        to: date(a.to),
                      })}
                </li>
              ))}
            </ul>
          )}
        </section>

        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className={`${secondaryButton} self-start`}
        >
          <LogoutIcon size={15} />
          {t('auth.signOut')}
        </button>
      </div>

      <section className={`${panel} self-start`}>
        <h3 className={caps}>{t('notifications.settingsTitle')}</h3>
        <p className="mt-1 text-[11.5px] leading-4 text-faint">{t('notifications.settingsHint')}</p>
        <NotificationToggles value={draft} onChange={setDraft} className="mt-4" />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className={secondaryButton}
            disabled={!dirty}
            onClick={() => settings && setDraft(settings)}
          >
            {t('notifications.cancel')}
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={!dirty || !draft || save.isPending}
            onClick={() => draft && save.mutate(draft)}
          >
            {t('profile.save')}
          </button>
        </div>
      </section>
    </div>
  );
}
