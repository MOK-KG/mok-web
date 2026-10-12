import { useTranslation } from 'react-i18next';
import { useSession, useSignOut } from '@/features/auth';

/** Временная главная: появится вместе с разделами платформы */
export function HomePage() {
  const { t } = useTranslation();
  const session = useSession();
  const signOut = useSignOut();

  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-4 p-6">
      <div className="flex items-center justify-between rounded-14 bg-panel p-4">
        <h1 className="font-semibold text-text">{t('app.title')}</h1>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          className="rounded-9 bg-surface px-3 py-2 text-sub hover:text-text"
        >
          {t('auth.signOut')}
        </button>
      </div>
      <section className="rounded-18 bg-card p-6">
        <p className="text-lg font-medium text-text">
          {t('home.greeting', { name: session.data?.user.name })}
        </p>
        <p className="mt-2 text-sub">{t('home.placeholder')}</p>
      </section>
    </main>
  );
}
