import { useTranslation } from 'react-i18next';

/** Временная страница раздела: сами разделы появятся по макетам */
export function SectionPage() {
  const { t } = useTranslation();
  return (
    <section className="rounded-18 border border-line bg-panel p-6">
      <p className="text-sub">{t('sections.placeholder')}</p>
    </section>
  );
}
