import logoColor from './assets/logo-color.svg';
import logoWhite from './assets/logo-white.svg';

export function BrandLogo({ height, className = '' }: { height: number; className?: string }) {
  const width = Math.round((height * 131.34) / 226.26);
  return (
    <span className={`relative block ${className}`} style={{ width, height }}>
      <img
        src={logoWhite}
        alt="Kyrgyz Republic NOC"
        width={width}
        height={height}
        className="hidden dark:block"
      />
      <img
        src={logoColor}
        alt="Kyrgyz Republic NOC"
        width={width}
        height={height}
        className="dark:hidden"
      />
    </span>
  );
}
