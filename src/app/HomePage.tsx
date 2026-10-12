import { Languages, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type Language, languageLabels, languages } from '@/shared/config/i18n';
import { formatDate } from '@/shared/lib/date';
import { useTheme } from './providers/ThemeProvider';

/** Временная стартовая страница для проверки темы и языка. Заменить на реальные экраны. */
export function HomePage() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4 rounded-14 bg-panel p-4">
        <div className="flex items-center gap-3">
          <span className="h-8 w-2 rounded-full bg-brand-red" aria-hidden />
          <h1 className="font-semibold">{t('app.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-9 bg-surface px-3 py-2 text-sub">
            <Languages size={16} aria-hidden />
            <span className="sr-only">{t('settings.language')}</span>
            <select
              className="bg-transparent text-text outline-none"
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value as Language)}
            >
              {languages.map((lng) => (
                <option key={lng} value={lng} className="bg-panel">
                  {languageLabels[lng]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-9 bg-surface px-3 py-2 text-text"
          >
            {theme === 'dark' ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
            {t(theme === 'dark' ? 'settings.dark' : 'settings.light')}
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-2 rounded-18 bg-card p-6">
        <p className="text-lg font-medium">{t('demo.greeting')}</p>
        <p className="text-sub">
          {t('demo.today', { date: formatDate(new Date(), 'd MMMM yyyy', i18n.language) })}
        </p>
        <div className="mt-4 flex gap-2">
          <span className="rounded-6 bg-surface px-2 py-1 text-success">success</span>
          <span className="rounded-6 bg-surface px-2 py-1 text-warning">warning</span>
          <span className="rounded-6 bg-surface px-2 py-1 text-danger">danger</span>
          <span className="rounded-6 bg-surface px-2 py-1 text-info">info</span>
        </div>
      </section>
    </main>
  );
}
