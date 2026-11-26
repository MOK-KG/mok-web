import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTheme } from '@/app/providers/ThemeProvider';
import type { Language } from '@/shared/config/i18n';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';
import { ThemeSwitch } from '@/shared/ui/ThemeSwitch';

type Section = { title: string; items: string[] };

export function PrivacyPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const sections = t('privacy.sections', { returnObjects: true }) as Section[];
  return (
    <div className="min-h-screen bg-panel">
      <div className="mx-auto flex max-w-[760px] flex-col px-6 pb-16 pt-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/login" className="text-[13px] font-medium text-brand-red hover:underline">
            {t('privacy.back')}
          </Link>
          <div className="flex gap-4">
            <LanguageSwitcher
              value={(i18n.resolvedLanguage ?? 'ru') as Language}
              onChange={(lng) => i18n.changeLanguage(lng)}
              label={t('settings.language')}
            />
            <ThemeSwitch
              value={theme}
              onChange={setTheme}
              labels={{
                group: t('settings.theme'),
                dark: t('settings.dark'),
                light: t('settings.light'),
              }}
            />
          </div>
        </div>
        <h1 className="mt-10 text-[30px] font-bold leading-[38px] tracking-[-0.6px] text-text">
          {t('privacy.title')}
        </h1>
        <p className="mt-2 text-[13px] text-faint">{t('privacy.updated')}</p>
        <p className="mt-6 text-[14.5px] leading-[24px] text-sub">{t('privacy.intro')}</p>
        {sections.map((s) => (
          <section key={s.title} className="mt-8">
            <h2 className="text-[17px] font-semibold tracking-[-0.2px] text-text">{s.title}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[14.5px] leading-[23px] text-sub">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
