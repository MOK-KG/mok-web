import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { links } from '@/shared/config/links';
import { Banner } from '@/shared/ui/Banner';
import { GoogleButton } from '@/shared/ui/GoogleButton';
import { AuthLayout } from './AuthLayout';
import { readSignInError } from './api';
import { useSignIn } from './useSession';

/**
 * Экран входа. Состояния из макета:
 * 1 — вход, 2 — переход в Google, 3 — отказ в доступе (чужой домен).
 * Состояние 4 «ожидает активации» — отдельная страница PendingPage.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const signIn = useSignIn();
  const error = readSignInError(search);
  const redirecting = signIn.isPending;

  const subtitle = redirecting ? t('auth.redirecting') : t('auth.subtitle');

  if (error && !redirecting) {
    return (
      <AuthLayout footerNote={t('auth.deniedFooter')} footerDivider>
        <h1 className="text-[32px] font-bold leading-[39px] tracking-[-0.7px] text-text">
          {t('auth.title')}
        </h1>
        <div className="mt-[14px]">
          <Banner tone="danger" title={t('auth.deniedTitle')}>
            {error.code === 'forbidden_domain'
              ? t('auth.deniedText', { email: error.email })
              : t('auth.genericError')}
          </Banner>
        </div>
        <GoogleButton className="mt-6" onClick={() => signIn.mutate()}>
          {t('auth.signInWithAnother')}
        </GoogleButton>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout footerNote={t('auth.noAccess')}>
      <h1 className="text-[32px] font-bold leading-[39px] tracking-[-0.7px] text-text">
        {t('auth.title')}
      </h1>
      <p
        className="mt-[9px] max-w-[300px] text-[14.5px] leading-[23px] text-sub"
        aria-live="polite"
      >
        {subtitle}
      </p>

      <GoogleButton className="mt-[28px]" loading={redirecting} onClick={() => signIn.mutate()}>
        {redirecting ? t('auth.openingGoogle') : t('auth.continueWithGoogle')}
      </GoogleButton>

      {signIn.isError && (
        <p role="alert" className="mt-3 text-[12.5px] text-danger">
          {t('auth.genericError')}
        </p>
      )}

      {redirecting ? (
        <p className="mt-6 text-[12.5px] leading-5 text-faint">{t('auth.popupHint')}</p>
      ) : (
        <>
          <div className="mt-9 flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span className="text-[11.5px] tracking-[0.4px] text-dim">{t('auth.noPassword')}</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <section className="mt-8 rounded-12 border border-line bg-surface px-5 pb-[14px] pt-5">
            <h2 className="text-[14px] font-semibold leading-[17px] tracking-[-0.1px] text-text">
              {t('auth.forgotTitle')}
            </h2>
            <p className="mt-3 max-w-[330px] text-[12.5px] leading-[21px] text-sub">
              {t('auth.forgotText')}
            </p>
            <div className="mt-[13px] border-t border-line pt-3">
              <a
                href={links.googleWorkspace}
                target="_blank"
                rel="noreferrer"
                className="text-[12.5px] font-medium text-info hover:underline"
              >
                {t('auth.openWorkspace')} →
              </a>
            </div>
          </section>
        </>
      )}
    </AuthLayout>
  );
}
