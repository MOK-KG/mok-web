import { useTranslation } from 'react-i18next';
import { toneClasses } from '@/features/tasks/ui';
import type { RoleCode } from '@/shared/config/permissions';
import type { Tone } from '@/shared/config/tokens';
import { initials } from '@/shared/lib/text';
import type { StaffBadge } from './types';

/** Цвет кода роли, как в макете; R5 и R9 — нейтральные */
const roleTone: Partial<Record<RoleCode, Tone>> = {
  R1: 'blue',
  R2: 'orange',
  R3: 'red',
  R4: 'green',
  R6: 'amber',
  R7: 'cyan',
  R8: 'violet',
};

/** Код роли в рамке: «R3» */
export function RoleCodeChip({ role, size = 'sm' }: { role: RoleCode; size?: 'sm' | 'md' }) {
  const tone = roleTone[role];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[5px] border font-semibold ${
        tone ? `border-current ${toneClasses[tone].text}` : 'border-line text-sub'
      } ${size === 'sm' ? 'h-5 w-[26px] text-[10px]' : 'h-5 w-[26px] text-[10.5px]'}`}
    >
      {role}
    </span>
  );
}

const badgeTone: Record<StaffBadge, string> = {
  active: 'bg-success-chip text-success',
  vacation: 'bg-info-chip text-info',
  invited: 'bg-warning-chip text-warning-text',
  external: 'bg-chip text-chip-text',
  vacancy: 'bg-muted-chip text-dim',
  deactivated: 'bg-danger-chip text-danger',
};

export function StatusBadge({ badge }: { badge: StaffBadge }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-6 px-[9px] text-[11px] font-medium ${badgeTone[badge]}`}
    >
      {t(`access.status.${badge}`)}
    </span>
  );
}

/** Аватар с инициалами; у вакансии — пунктирный круг с «?» */
export function StaffAvatar({
  name,
  tone,
  size,
}: {
  name: string | null;
  tone: Tone;
  size: 30 | 48;
}) {
  const box = size === 30 ? 'size-[30px] text-[10.5px]' : 'size-12 text-[15px]';
  if (!name) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-full border border-dashed border-line text-dim ${box}`}
      >
        ?
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${toneClasses[tone].bg} ${toneClasses[tone].text} ${box}`}
    >
      {initials(name)}
    </span>
  );
}

/** Подпись блока: «РОЛЬ», «СВЕДЕНИЯ» */
export const capsTitle = 'text-[10px] font-semibold uppercase tracking-[1.4px] text-dim';
