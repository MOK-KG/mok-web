import { useTranslation } from 'react-i18next';
import { workDomain } from '@/shared/config/links';
import glowDark from '@/shared/ui/assets/glow-dark.svg';
import glowLight from '@/shared/ui/assets/glow-light.svg';
import { OlympicRings } from '@/shared/ui/OlympicRings';

/** Центры диагональных линий из макета (x, px) */
const lineCenters = [-60, 58, 176, 294, 412];

/** Левая брендовая панель экрана входа (web, 660px) */
export function BrandPanel() {
  const { t } = useTranslation();
  return (
    <aside className="relative hidden overflow-hidden bg-canvas lg:block">
      {lineCenters.map((x) => (
        <span
          key={x}
          aria-hidden
          className="absolute top-[-132px] h-[1160px] w-[2px] rotate-12 bg-text opacity-[0.035]"
          style={{ left: x - 1 }}
        />
      ))}
      <img
        src={glowDark}
        alt=""
        aria-hidden
        width={960}
        height={960}
        className="absolute left-[-340px] top-[240px] hidden max-w-none dark:block"
      />
      <img
        src={glowLight}
        alt=""
        aria-hidden
        width={960}
        height={960}
        className="absolute left-[-340px] top-[240px] max-w-none dark:hidden"
      />

      <div className="relative flex h-full flex-col px-[72px] pb-16 pt-24">
        <OlympicRings />
        <p className="mt-7 text-[11px] font-semibold tracking-[1.8px] text-faint">
          {t('auth.orgName')}
        </p>
        <span className="mt-[91px] h-[3px] w-14 rounded-full bg-brand-red" aria-hidden />
        <h2 className="mt-5 max-w-[520px] text-[44px] font-bold leading-[54px] tracking-[-1.2px] text-text">
          {t('auth.headline1')}
          <br />
          {t('auth.headline2')}
        </h2>
        <p className="mt-6 max-w-[410px] text-[15px] leading-[26px] text-sub">
          {t('auth.tagline')}
        </p>
        <p className="mt-auto text-[12px] font-medium tracking-[0.3px] text-dim">{workDomain}</p>
      </div>
    </aside>
  );
}
