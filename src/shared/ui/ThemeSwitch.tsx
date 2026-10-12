import { Moon, Sun } from 'lucide-react';
import type { ThemeName } from '@/shared/config/tokens';

type Props = {
  value: ThemeName;
  onChange: (theme: ThemeName) => void;
  labels: { group: string; dark: string; light: string };
};

/** Переключатель темы: луна / солнце (сегменты в «таблетке») */
export function ThemeSwitch({ value, onChange, labels }: Props) {
  const options = [
    {
      theme: 'dark' as const,
      Icon: Moon,
      label: labels.dark,
      checked: 'peer-checked:text-brand-gold',
    },
    {
      theme: 'light' as const,
      Icon: Sun,
      label: labels.light,
      checked: 'peer-checked:text-warning',
    },
  ];
  return (
    <fieldset className="flex h-[34px] items-center gap-[14px] rounded-full border border-line bg-control p-[3px]">
      <legend className="sr-only">{labels.group}</legend>
      {options.map(({ theme, Icon, label, checked }) => (
        <label key={theme} className="cursor-pointer">
          <input
            type="radio"
            name="theme"
            value={theme}
            checked={theme === value}
            onChange={() => onChange(theme)}
            aria-label={label}
            className="peer sr-only"
          />
          <span
            className={`flex size-[26px] items-center justify-center rounded-full text-faint transition-colors hover:text-sub peer-checked:bg-control-active peer-checked:shadow-[0_1px_3px_rgba(0,0,0,0.12)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-info ${checked}`}
          >
            <Icon size={13} aria-hidden />
          </span>
        </label>
      ))}
    </fieldset>
  );
}
