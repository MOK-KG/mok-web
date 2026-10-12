import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCan, useSession, useSignOut } from '@/features/auth';
import { type Section, sections } from '@/shared/config/permissions';

/** Временная главная: разделы, доступные роли пользователя. Остальные не показываются */
export function HomePage() {
  const { t } = useTranslation();
  const session = useSession();
  const signOut = useSignOut();
  const { can } = useCan();
  const user = session.data?.user;
  const allowed = (Object.keys(sections) as Section[]).filter((s) => can(sections[s]));

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
        <p className="text-lg font-medium text-text">{t('home.greeting', { name: user?.name })}</p>
        <p className="mt-1 text-[13px] text-faint">
          {t('home.roles', { roles: user?.roles.join(', ') })}
        </p>
        {allowed.length > 0 ? (
          <nav aria-label={t('home.sections')} className="mt-5 grid grid-cols-2 gap-2">
            {allowed.map((section) => (
              <Link
                key={section}
                to={`/${section}`}
                className="rounded-12 border border-line bg-surface px-4 py-3 font-medium text-text hover:opacity-90"
              >
                {t(`sections.${section}`)}
              </Link>
            ))}
          </nav>
        ) : (
          <p className="mt-4 text-sub">{t('home.noSections')}</p>
        )}
      </section>
    </main>
  );
}
