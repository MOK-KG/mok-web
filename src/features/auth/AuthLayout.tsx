import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/app/providers/ThemeProvider';
import type { Language } from '@/shared/config/i18n';
import { links } from '@/shared/config/links';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';
import { ThemeSwitch } from '@/shared/ui/ThemeSwitch';
import { BrandPanel } from './BrandPanel';

type Props = {
  children: ReactNode;
  /** Подпись над ссылкой «Написать администратору» */
  footerNote: string;
  /** Разделитель перед подписью (состояния «отказ» и «ожидает активации») */
  footerDivider?: boolean;
};

/** Раскладка экранов авторизации: брендовая панель слева, форма справа */
export function AuthLayout({ children, footerNote, footerDivider = false }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid min-h-screen bg-panel lg:grid-cols-[660px_1fr]">
      <BrandPanel />
      <main className="relative flex flex-col items-center px-6 pb-16 pt-28 lg:pt-[278px]">
        <div className="absolute right-6 top-6 flex gap-4 lg:right-12 lg:top-10">
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

        <div className="w-full max-w-[420px]">
          {children}
          {footerDivider && <hr className="mt-[42px] border-line" />}
          <div
            className={`text-[12.5px] tracking-[0.1px] ${footerDivider ? 'mt-[21px]' : 'mt-14'}`}
          >
            <p className="text-faint">{footerNote}</p>
            <a
              href={links.contactAdmin}
              className="mt-[6px] inline-block font-medium text-brand-red hover:underline"
            >
              {t('auth.contactAdmin')}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
