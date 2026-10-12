import { type Language, languageLabels, languages } from '@/shared/config/i18n';

type Props = {
  value: Language;
  onChange: (language: Language) => void;
  label: string;
};

/** Переключатель языка RU / KY / EN (сегменты в «таблетке») */
export function LanguageSwitcher({ value, onChange, label }: Props) {
  return (
    <fieldset className="flex h-[34px] items-center rounded-full border border-line bg-control p-[3px]">
      <legend className="sr-only">{label}</legend>
      {languages.map((lng) => (
        <label key={lng} className="cursor-pointer">
          <input
            type="radio"
            name="language"
            value={lng}
            checked={lng === value}
            onChange={() => onChange(lng)}
            aria-label={languageLabels[lng]}
            className="peer sr-only"
          />
          <span className="flex h-[26px] w-[42px] items-center justify-center rounded-full text-[11.5px] font-medium uppercase tracking-[0.4px] text-faint transition-colors hover:text-sub peer-checked:bg-control-active peer-checked:font-semibold peer-checked:text-text peer-checked:shadow-[0_1px_3px_rgba(0,0,0,0.12)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-info">
            {lng}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
