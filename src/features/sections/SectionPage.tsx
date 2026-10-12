import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Section } from '@/shared/config/permissions';

/** Временная страница раздела: сами разделы появятся по макетам */
export function SectionPage({ section }: { section: Section }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-4 p-6">
      <Link to="/" className="text-[13px] font-medium text-info hover:underline">
        ← {t('sections.home')}
      </Link>
      <section className="rounded-18 bg-card p-6">
        <h1 className="text-[24px] font-bold text-text">{t(`sections.${section}`)}</h1>
        <p className="mt-2 text-sub">{t('sections.placeholder')}</p>
      </section>
    </main>
  );
}
