import { addDays, type IsoDate, nextWorkingDay, todayInBishkek } from '@/shared/lib/workDays';
import { people, projects } from './directory';
import type { Person, Project, Task } from './types';

/**
 * Очередь из почты info@olympic.kg: письма, которые модель разобрала в предложения задач.
 * Задача создаётся только после подтверждения человеком (макет Figma: «Очередь из почты»).
 */

export type SuggestionField = 'title' | 'assignee' | 'due' | 'project' | 'priority';

/**
 * Пометки модели по полям: confirm — «уточнить», создать можно;
 * missing — модель не смогла заполнить, создать нельзя, пока поле не заполнят.
 */
export type FieldFlag = 'confirm' | 'missing';

export type Suggestion = {
  title: string;
  assignee: Person | null;
  due: IsoDate | null;
  project: Project | null;
  priority: Task['priority'];
  flags: Partial<Record<SuggestionField, FieldFlag>>;
};

export type Letter = {
  id: string;
  sender: string;
  address: string;
  /** Подпись организации в шапке письма: «International Olympic Committee» */
  organization: string;
  subject: string;
  receivedAt: string;
  body: string;
  attachments: string[];
  /** null — модель не смогла разобрать письмо, задачу оформляют вручную */
  suggestion: Suggestion | null;
};

export const canCreate = (s: Suggestion) =>
  !Object.values(s.flags).includes('missing') &&
  s.title.trim().length >= 3 &&
  s.assignee !== null &&
  s.due !== null;

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** ЗАГЛУШКА очереди (до бэкенда). Время — относительно «сейчас», сроки — от сегодня */
export function createMockQueue(today: IsoDate = todayInBishkek()): Letter[] {
  return [
    {
      id: 'mail-1',
      sender: 'МОК · Лозанна',
      organization: 'International Olympic Committee',
      address: 'compliance@olympic.org',
      subject: 'Request for anti-doping programme update',
      receivedAt: hoursAgo(2),
      body: '“Please provide an updated anti-doping compliance report covering the 2025–2026 period. The submission deadline is in two days. Attachments: template, prior report.”',
      attachments: ['template_2026.docx', 'report_2025.pdf'],
      suggestion: {
        title: 'Обновить антидопинговый отчёт за 2025–2026',
        assignee: people.dt,
        due: nextWorkingDay(addDays(today, 2)),
        project: projects.antidoping,
        priority: 'high',
        flags: { project: 'confirm', priority: 'confirm' },
      },
    },
    {
      id: 'mail-2',
      sender: 'АНОК · Секретариат',
      organization: 'Association of National Olympic Committees',
      address: 'secretariat@anocolympic.org',
      subject: 'Приглашение на Генеральную ассамблею',
      receivedAt: hoursAgo(5),
      body: '«Приглашаем делегацию НОК Кыргызской Республики на Генеральную ассамблею АНОК. Просим подтвердить состав делегации.»',
      attachments: ['programme.pdf'],
      suggestion: {
        title: 'Подтвердить участие в Генассамблее АНОК',
        assignee: people.ad,
        due: nextWorkingDay(addDays(today, 21)),
        project: projects.international,
        priority: 'normal',
        flags: {},
      },
    },
    {
      id: 'mail-3',
      sender: 'Минюст КР',
      organization: 'Министерство юстиции Кыргызской Республики',
      address: 'info@minjust.gov.kg',
      subject: 'О предоставлении перевода устава',
      receivedAt: hoursAgo(26),
      body: '«Просим предоставить официальный перевод устава НОК КР на государственный язык.»',
      attachments: [],
      suggestion: {
        title: 'Направить в Минюст перевод устава',
        assignee: null,
        due: nextWorkingDay(addDays(today, 16)),
        project: projects.legal,
        priority: 'normal',
        flags: { assignee: 'missing' },
      },
    },
    {
      id: 'mail-4',
      sender: 'info@kumtor.kg',
      organization: 'Kumtor Gold',
      address: 'info@kumtor.kg',
      subject: 'Re: спонсорское соглашение 2026',
      receivedAt: hoursAgo(50),
      body: '«Направляем комментарии к проекту соглашения, см. вложение.»',
      attachments: ['agreement_comments.docx'],
      suggestion: null,
    },
  ];
}
