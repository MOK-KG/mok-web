import ringDark1 from './assets/ring-dark-1.svg';
import ringDark2 from './assets/ring-dark-2.svg';
import ringDark3 from './assets/ring-dark-3.svg';
import ringDark4 from './assets/ring-dark-4.svg';
import ringDark5 from './assets/ring-dark-5.svg';
import ringLight1 from './assets/ring-light-1.svg';
import ringLight2 from './assets/ring-light-2.svg';
import ringLight3 from './assets/ring-light-3.svg';
import ringLight4 from './assets/ring-light-4.svg';
import ringLight5 from './assets/ring-light-5.svg';

const dark = [ringDark1, ringDark2, ringDark3, ringDark4, ringDark5];
const light = [ringLight1, ringLight2, ringLight3, ringLight4, ringLight5];

/** Пять колец из макета: 44px, шаг 34px. У каждой темы свой набор цветов */
export function OlympicRings({ className = '' }: { className?: string }) {
  return (
    <div className={`relative h-[44px] w-[180px] ${className}`} role="img" aria-label="НОК КР">
      {dark.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          width={44}
          height={44}
          className="absolute top-0 hidden dark:block"
          style={{ left: i * 34 }}
        />
      ))}
      {light.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          width={44}
          height={44}
          className="absolute top-0 dark:hidden"
          style={{ left: i * 34 }}
        />
      ))}
    </div>
  );
}
