import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/shared/ui/Banner';
import { AuthLayout } from './AuthLayout';
import { useSession, useSignOut } from './useSession';

/** Состояние 4 из макета: вошёл через Google, но роль ещё не назначена */
export function PendingPage() {
  const { t } = useTranslation();
  const session = useSession();
  const signOut = useSignOut();
  const email = session.data?.user.email ?? '';
  const [checking, setChecking] = useState(false);
  const refresh = () => {
    setChecking(true);
    session.refetch().finally(() => setChecking(false));
  };

  return (
    <AuthLayout footerNote={t('auth.urgentAccess')} footerDivider>
      <h1 className="text-[32px] font-bold leading-[39px] tracking-[-0.7px] text-text">
        {t('auth.pendingTitle')}
      </h1>
      <p className="mt-[10px] text-[14.5px] leading-[23px] text-sub">
        {t('auth.signedInAs', { email })}
      </p>
      <div className="mt-[26px]">
        <Banner
          tone="warning"
          title={t('auth.pendingBannerTitle')}
          action={
            <button
              type="button"
              onClick={refresh}
              disabled={checking}
              aria-busy={checking}
              className="inline-flex items-center gap-[6px] text-[12.5px] font-medium text-info hover:underline disabled:cursor-default disabled:no-underline"
            >
              {checking && (
                <span
                  aria-hidden
                  className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                />
              )}
              {checking ? t('auth.checkingStatus') : t('auth.refreshStatus')}
            </button>
          }
        >
          {t('auth.pendingBannerText')}
        </Banner>
      </div>
      <button
        type="button"
        onClick={() => signOut.mutate()}
        className="mt-4 text-[12.5px] font-medium text-sub hover:text-text"
      >
        {t('auth.signOut')}
      </button>
    </AuthLayout>
  );
}
