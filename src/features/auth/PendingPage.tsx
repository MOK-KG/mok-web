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
              onClick={() => session.refetch()}
              disabled={session.isFetching}
              className="text-[12.5px] font-medium text-info hover:underline disabled:opacity-50"
            >
              {t('auth.refreshStatus')}
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
