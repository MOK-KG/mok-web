import { useTranslation } from 'react-i18next';
import { absenceOf, isAbsentOn } from '@/features/tasks/absences';
import { toneClasses } from '@/features/tasks/ui';
import { formatIsoDate } from '@/shared/lib/date';
import { initials } from '@/shared/lib/text';
import { addDays, todayInBishkek } from '@/shared/lib/workDays';
import { chatMembers } from './api';
import type { ChatMember, ChatMessage } from './types';

/** Аватар участника; точка — в отпуске (как в макете у М. Эсеновой) */
export function MemberAvatar({ member, size = 32 }: { member: ChatMember; size?: 30 | 32 }) {
  const tone = toneClasses[member.tone];
  const away = useAway(member.id);
  return (
    <span className="relative shrink-0">
      <span
        aria-hidden
        className={`flex items-center justify-center rounded-full font-semibold ${tone.bg} ${tone.text} ${
          size === 32 ? 'size-8 text-[11px]' : 'size-[30px] text-[10.5px]'
        }`}
      >
        {initials(member.name)}
      </span>
      {away && (
        <span
          aria-hidden
          className="absolute -bottom-px -right-px size-[9px] rounded-full border-[1.5px] border-panel bg-info"
        />
      )}
    </span>
  );
}

/** Код роли у сообщения — серая плашка, как в макете */
export function RoleChip({ role }: { role: string }) {
  return (
    <span className="flex h-4 items-center rounded-[4px] bg-chip px-[6px] text-[9.5px] font-semibold text-chip-text">
      {role}
    </span>
  );
}

/** Отпуск, который идёт сейчас: до какого дня и кто замещает */
export function useAway(memberId: string | null) {
  if (!memberId) return null;
  const absence = absenceOf(memberId);
  return absence && isAbsentOn(absence, todayInBishkek()) ? absence : null;
}

/** «8 сент» — короткий месяц без точки, как на карточках доски */
export const shortDay = (day: string, lang: string) =>
  formatIsoDate(day, 'd MMM', lang).replace('.', '');

/**
 * «R5 · Медицинский», «R4 · в отпуске до 22 сент»; у аппарата — название роли
 * («R1 · Администратор»), как в макете: аппарат — не департамент
 */
export function useMemberLine(memberId: string | null) {
  const { t, i18n } = useTranslation();
  const away = useAway(memberId);
  const member = memberId ? chatMembers[memberId] : null;
  if (!member) return '';
  const where = away
    ? t('chat.vacationUntil', { date: shortDay(away.to, i18n.language) })
    : member.department === 'Аппарат'
      ? t(`access.roles.${member.role}`)
      : member.department;
  return `${member.role} · ${where}`;
}

/** «Сегодня», «Вчера» или дата — подпись дня в переписке */
export function useDayLabel() {
  const { t, i18n } = useTranslation();
  const today = todayInBishkek();
  return (day: string) =>
    day === today
      ? t('chat.today')
      : day === addDays(today, -1)
        ? t('chat.yesterday')
        : formatIsoDate(
            day,
            day.startsWith(today.slice(0, 4)) ? 'd MMMM' : 'd MMMM yyyy',
            i18n.language,
          );
}

/** День сообщения по Бишкеку (UTC+6) — для разделителей «Вчера / Сегодня» */
export const dayOf = (iso: string) =>
  new Date(Date.parse(iso) + 6 * 3_600_000).toISOString().slice(0, 10);

/** Время сообщения по Бишкеку: «14:02» */
export const timeOf = (iso: string) =>
  new Date(Date.parse(iso) + 6 * 3_600_000).toISOString().slice(11, 16);

/** Короткая подпись последнего сообщения для списка чатов */
export function usePreview() {
  const { t } = useTranslation();
  return (m: ChatMessage | null, me: string) => {
    if (!m) return '';
    if (m.kind === 'system') {
      return m.system?.kind === 'autoreply'
        ? t('chat.autoreplyShort', { deputy: m.text })
        : (m.system?.title ?? m.text);
    }
    const body =
      m.kind === 'task'
        ? `${t('chat.taskFromBoard')}: ${m.task?.title}`
        : m.file && !m.text
          ? `${m.file.name}.${m.file.ext}`
          : m.text;
    if (m.authorId === me) return `${t('chat.you')}: ${body}`;
    const author = m.authorId ? chatMembers[m.authorId] : null;
    return author ? `${author.name.split(' ')[0]}: ${body}` : body;
  };
}

/** Текст с подсветкой упоминаний «@А. Дуйшеев» */
export function MessageText({ text }: { text: string }) {
  const parts = text.split(/(@[А-ЯЁA-Z]\. [А-ЯЁA-Z][а-яёa-z-]+)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: части текста не переставляются
          <span key={i} className="font-medium text-info">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Значок канала департамента: «#» в квадрате */
export function ChannelIcon() {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-8 bg-chip text-[15px] font-semibold text-sub"
    >
      #
    </span>
  );
}
