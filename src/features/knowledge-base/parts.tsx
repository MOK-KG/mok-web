import { useTranslation } from 'react-i18next';
import type { Person } from '@/features/tasks/types';
import { toneClasses } from '@/features/tasks/ui';
import { formatIsoDate } from '@/shared/lib/date';
import { initials } from '@/shared/lib/text';
import { type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { CheckBadgeIcon } from '@/shared/ui/icons';
import type { KbFreshness } from './types';

/** «3 сентября» в текущем году, «3 сентября 2025» — в другом */
export function useShortDate() {
  const { i18n } = useTranslation();
  const year = todayInBishkek().slice(0, 4);
  return (date: IsoDate) =>
    formatIsoDate(date, date.startsWith(year) ? 'd MMMM' : 'd MMMM yyyy', i18n.language);
}

export function Avatar({ person, size }: { person: Person; size: 20 | 24 }) {
  const tone = toneClasses[person.tone];
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tone.bg} ${tone.text} ${
        size === 20 ? 'size-5 text-[8.5px]' : 'size-6 text-[9.5px]'
      }`}
    >
      {initials(person.name)}
    </span>
  );
}

/** Метка «Актуально» / «Давно не обновляли»; в карточке статьи — крупнее и с галочкой */
export function FreshnessBadge({
  freshness,
  large = false,
}: {
  freshness: KbFreshness;
  large?: boolean;
}) {
  const { t } = useTranslation();
  if (!freshness) return null;
  const tone =
    freshness === 'fresh' ? 'bg-success-chip text-success' : 'bg-warning-chip text-warning-text';
  return (
    <span
      className={`flex shrink-0 items-center font-medium ${tone} ${
        large
          ? 'h-[22px] gap-1 rounded-6 px-2 text-[10.5px]'
          : 'h-5 rounded-[5px] px-[7px] text-[10px]'
      }`}
    >
      {large && freshness === 'fresh' && <CheckBadgeIcon size={12} />}
      {t(`knowledge.${freshness}`)}
    </span>
  );
}

/** Подпись блока боковой панели: «РАЗДЕЛЫ», «СОДЕРЖАНИЕ» */
export const capsTitle = 'text-[10px] font-semibold uppercase tracking-[1.4px] text-dim';
