import { mockAbsences } from '@/features/tasks/absences';
import { people } from '@/features/tasks/directory';
import { addDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import type { Chat, ChatMember, ChatMessage } from './types';

/**
 * ЗАГЛУШКА чата (до бэкенда): каналы и сообщения из макета.
 * Люди — из справочника задач (имена, цвета), роли и департаменты — как в разделе
 * «Роли и доступ». Имена вымышленные (см. CLAUDE.md, раздел «Данные»).
 *
 * Время свежих сообщений — относительно «сейчас», чтобы совпадать с уведомлениями:
 * эскалация 12 минут назад, упоминание 3 часа назад.
 */
export const currentMemberId = people.ad.id;

const member = (
  p: { id: string; name: string; short: string; tone: ChatMember['tone'] },
  role: ChatMember['role'],
  department: string,
): ChatMember => ({ id: p.id, name: p.name, short: p.short, tone: p.tone, role, department });

export const chatMembers: Record<string, ChatMember> = Object.fromEntries(
  [
    member(people.ad, 'R3', 'Аппарат'),
    member(people.ka, 'R6', 'Административный'),
    member(people.nb, 'R5', 'Административный'),
    member(people.dt, 'R5', 'Медицинский'),
    member(people.me, 'R4', 'Медицинский'),
    member(people.ju, 'R5', 'Правовой'),
    member(
      { id: 'u-at', name: 'Азамат Турсунов', short: 'А. Турсунов', tone: 'cyan' },
      'R1',
      'Аппарат',
    ),
    member(
      { id: 'u-bo', name: 'Бакыт Осмонов', short: 'Б. Осмонов', tone: 'green' },
      'R4',
      'Административный',
    ),
    member(
      { id: 'u-ca', name: 'Чолпон Абдыкадырова', short: 'Ч. Абдыкадырова', tone: 'gold' },
      'R2',
      'Аппарат',
    ),
  ].map((m) => [m.id, m]),
);

export function createMockChat(now: number = Date.now(), today: IsoDate = todayInBishkek()) {
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const onDay = (daysAgo: number, time: string) => `${addDays(today, -daysAgo)}T${time}:00+06:00`;
  let n = 0;
  const msg = (chatId: string, authorId: string | null, at: string, text: string, extra = {}) =>
    ({ id: `m-${++n}`, chatId, authorId, at, kind: 'text', text, ...extra }) as ChatMessage;

  const { ad, ka, nb, dt, me } = people;
  const vacation = mockAbsences(today).find((a) => a.person.id === me.id);
  const messages: ChatMessage[] = [
    // Административный — из макета
    msg(
      'c-admin',
      ka.id,
      onDay(1, '16:20'),
      'Зарегистрировал исходящее в АНОК, номер 2026-0247. Журнал сверил, пропусков нет.',
    ),
    msg(
      'c-admin',
      nb.id,
      onDay(1, '16:34'),
      'Спасибо. По уставу черновик глав 1–4 готов, отдал юристу на сверку.',
    ),
    msg(
      'c-admin',
      ad.id,
      ago(90),
      'Коллеги, по переводу устава сроки горят. Минюст ждёт до конца сентября.',
    ),
    msg('c-admin', ad.id, ago(89), '', {
      kind: 'task',
      task: {
        title: 'Перевод устава на кыргызский язык',
        status: 'in_progress',
        assignee: nb.short,
        due: addDays(today, 9),
      },
    }),
    msg(
      'c-admin',
      null,
      ago(12),
      'Уведомление не открыто 4 часа · передано директору департамента',
      {
        kind: 'system',
        system: { kind: 'escalation', title: 'Эскалация по задаче «Перевод устава»' },
      },
    ),
    msg(
      'c-admin',
      ka.id,
      ago(5),
      'Принял. Регистрационные номера за сентябрь свёл, к пятнице пришлю сводку.',
    ),
    // Медицинский
    msg(
      'c-medical',
      me.id,
      onDay(1, '10:15'),
      'Смету на Азиатские игры отправила на согласование, жду правки до среды.',
    ),
    msg(
      'c-medical',
      dt.id,
      ago(180),
      '@А. Дуйшеев нужен ваш комментарий по статье 4.2 сметы — расходы на допинг-контроль.',
    ),
    msg('c-medical', dt.id, ago(150), 'смета на согласовании'),
    // Личные
    msg(
      'c-dt',
      dt.id,
      onDay(1, '11:02'),
      'Айбек, посмотрите, пожалуйста, протокол комиссии спортсменов.',
    ),
    msg('c-dt', ad.id, onDay(1, '11:40'), 'посмотрю к среде'),
    msg('c-me', ad.id, onDay(1, '09:30'), 'Мээрим, нужна справка по медосмотрам делегации.'),
    // Автоответ: text — заместитель, title — до какого дня отпуск (из графика отпусков)
    msg('c-me', null, onDay(1, '09:30'), vacation?.deputy.short ?? '', {
      kind: 'system',
      system: { kind: 'autoreply', title: vacation?.to ?? today },
    }),
    msg('c-nb', nb.id, onDay(55, '17:10'), 'Черновик перевода готов'),
    msg('c-at', ad.id, onDay(58, '10:00'), 'Азамат, выдайте доступ Н. Бакирову к платформе.'),
    msg('c-at', 'u-at', onDay(58, '10:25'), 'Доступ выдан'),
  ];

  const lastAt = (chatId: string) =>
    messages.filter((m) => m.chatId === chatId).at(-1)?.at ?? ago(0);

  const chats: Chat[] = [
    {
      id: 'c-admin',
      kind: 'channel',
      title: 'Административный',
      fullTitle: 'Административный департамент',
      memberIds: [ka.id, nb.id, ad.id, 'u-bo', 'u-ca'],
      peerId: null,
      // Непрочитанные: эскалация и последнее сообщение К. Асанова
      readAt: ago(60),
      muted: false,
    },
    {
      id: 'c-medical',
      kind: 'channel',
      title: 'Медицинский',
      fullTitle: 'Медицинский департамент',
      memberIds: [me.id, dt.id, ad.id, people.ju.id],
      peerId: null,
      readAt: ago(170),
      muted: false,
    },
    ...[
      ['c-dt', dt.id],
      ['c-me', me.id],
      ['c-nb', nb.id],
      ['c-at', 'u-at'],
    ].map(
      ([id, peerId]): Chat => ({
        id,
        kind: 'direct',
        title: chatMembers[peerId].name,
        fullTitle: chatMembers[peerId].name,
        memberIds: [ad.id, peerId],
        peerId,
        readAt: lastAt(id),
        muted: false,
      }),
    ),
  ];

  return { chats, messages };
}
