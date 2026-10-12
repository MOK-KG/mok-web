import { addDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import type { Person, Project, Task, TaskStatus } from './types';

/**
 * ЗАГЛУШКА задач до появления бэкенда: задачи из макета Figma.
 * Сроки задаются СМЕЩЕНИЕМ от сегодняшнего дня, чтобы «Просрочено 1 дн» оставалось
 * верным в любой день. Имена вымышленные (см. CLAUDE.md, раздел «Данные»).
 */

export const people = {
  ad: { id: 'u-ad', name: 'Айбек Дуйшеев', short: 'А. Дуйшеев', tone: 'blue' },
  nb: { id: 'u-nb', name: 'Нурлан Бакиров', short: 'Н. Бакиров', tone: 'red' },
  dt: { id: 'u-dt', name: 'Дамира Токтосунова', short: 'Д. Токтосунова', tone: 'purple' },
  ka: { id: 'u-ka', name: 'Канат Асанов', short: 'К. Асанов', tone: 'amber' },
  me: { id: 'u-me', name: 'Мээрим Эсенова', short: 'М. Эсенова', tone: 'green' },
} satisfies Record<string, Person>;

/** Текущий пользователь заглушки — Айбек Дуйшеев */
export const currentUserId = people.ad.id;

export const projects = {
  antidoping: { id: 'p-antidoping', name: 'Антидопинг 2026', tone: 'green' },
  accreditation: { id: 'p-accreditation', name: 'Аккредитация', tone: 'violet' },
  legal: { id: 'p-legal', name: 'Правовая база 2026', tone: 'gold' },
  asian: { id: 'p-asian', name: 'Азиатские игры 2026', tone: 'blue' },
  international: { id: 'p-international', name: 'Международные связи', tone: 'orange' },
  partners: { id: 'p-partners', name: 'Партнёры и спонсоры', tone: 'purple' },
  grants: { id: 'p-grants', name: 'Гранты и заявки', tone: 'cyan' },
} satisfies Record<string, Project>;

type Seed = Partial<Task> &
  Pick<Task, 'title' | 'status' | 'project' | 'author'> & {
    /** Смещение срока от сегодня в днях; null — без срока */
    dueIn: number | null;
  };

let counter = 400;

function make(seed: Seed, today: IsoDate): Task {
  counter += 1;
  const { dueIn, ...rest } = seed;
  return {
    id: `t-${counter}`,
    code: `ЗД-2026-${String(counter).padStart(4, '0')}`,
    assignee: null,
    priority: 'normal',
    subtasks: 0,
    comments: 0,
    attachments: 0,
    fromEmail: false,
    reschedules: 0,
    escalationHours: null,
    deputy: null,
    due: dueIn === null ? null : addDays(today, dueIn),
    ...rest,
  };
}

const { ad, nb, dt, ka, me } = people;
const p = projects;

/** 20 задач департамента: 6 в очереди, 4 в работе, 2 на проверке, 8 готово */
function departmentSeeds(): Seed[] {
  const queue: Seed[] = [
    {
      title: 'Ответить на запрос МОК по антидопинговой программе',
      status: 'queue',
      project: p.antidoping,
      author: ka,
      assignee: ad,
      dueIn: -1,
      fromEmail: true,
      attachments: 2,
      reschedules: 1,
      priority: 'high',
    },
    {
      title: 'Обновить регламент аккредитации журналистов',
      status: 'queue',
      project: p.accreditation,
      author: ad,
      assignee: ka,
      dueIn: 2,
      subtasks: 4,
    },
    {
      title: 'Согласовать состав делегации на Генассамблею АНОК',
      status: 'queue',
      project: p.international,
      author: dt,
      assignee: ad,
      dueIn: 89,
      fromEmail: true,
      comments: 3,
    },
    {
      title: 'Справка по лицензиям федераций для Исполкома',
      status: 'queue',
      project: p.legal,
      author: ad,
      assignee: ka,
      dueIn: null,
    },
    {
      title: 'Список волонтёров для Игр Центральной Азии',
      status: 'queue',
      project: p.asian,
      author: nb,
      assignee: me,
      dueIn: 30,
    },
    {
      title: 'Протокол заседания комиссии спортсменов',
      status: 'queue',
      project: p.international,
      author: dt,
      assignee: dt,
      dueIn: 14,
      comments: 1,
    },
  ];
  const inProgress: Seed[] = [
    {
      title: 'Перевод устава на кыргызский язык',
      status: 'in_progress',
      project: p.legal,
      author: ad,
      assignee: nb,
      dueIn: 9,
      escalationHours: 4,
      reschedules: 2,
      priority: 'high',
      subtasks: 4,
      comments: 5,
    },
    {
      title: 'Смета на Азиатские игры 2026',
      status: 'in_progress',
      project: p.asian,
      author: ka,
      assignee: dt,
      dueIn: 6,
      subtasks: 6,
      comments: 11,
      attachments: 3,
    },
    {
      title: 'Договор со спонсором — Kumtor Gold',
      status: 'in_progress',
      project: p.partners,
      author: dt,
      assignee: ad,
      dueIn: 12,
      comments: 5,
      attachments: 1,
    },
    {
      title: 'Заявка на грант Олимпийской солидарности',
      status: 'in_progress',
      project: p.grants,
      author: ad,
      assignee: ka,
      dueIn: 22,
      attachments: 4,
    },
  ];
  const review: Seed[] = [
    {
      title: 'Антидопинговый план на 2027 год',
      status: 'review',
      project: p.antidoping,
      author: ad,
      assignee: me,
      deputy: nb,
      dueIn: 16,
      subtasks: 3,
      comments: 7,
    },
    {
      title: 'Ответ федерации лёгкой атлетики по составу',
      status: 'review',
      project: p.international,
      author: ad,
      assignee: dt,
      dueIn: null,
      fromEmail: true,
      comments: 2,
    },
  ];
  const done: Seed[] = [
    {
      title: 'Квартальный отчёт для ОКС',
      status: 'done',
      project: p.grants,
      author: ad,
      assignee: dt,
      dueIn: -5,
      attachments: 2,
    },
    {
      title: 'Состав судейской коллегии на чемпионат',
      status: 'done',
      project: p.accreditation,
      author: dt,
      assignee: ka,
      dueIn: -8,
      comments: 4,
    },
    {
      title: 'Аккредитация на зимние Игры — список',
      status: 'done',
      project: p.accreditation,
      author: ka,
      assignee: ad,
      dueIn: -10,
    },
    {
      title: 'Письмо в Минспорт о календаре соревнований',
      status: 'done',
      project: p.legal,
      author: ad,
      assignee: ad,
      dueIn: -12,
    },
    {
      title: 'Отчёт по стипендиям спортсменов',
      status: 'done',
      project: p.grants,
      author: nb,
      assignee: ad,
      dueIn: -15,
      attachments: 1,
    },
    {
      title: 'Регистрация делегации на Азиатские игры',
      status: 'done',
      project: p.asian,
      author: ad,
      assignee: me,
      dueIn: -18,
    },
    {
      title: 'Памятка по антидопинговым правилам',
      status: 'done',
      project: p.antidoping,
      author: me,
      assignee: ad,
      dueIn: -20,
    },
    {
      title: 'Протокол встречи с партнёрами',
      status: 'done',
      project: p.partners,
      author: ka,
      assignee: dt,
      dueIn: -21,
    },
  ];
  return [...queue, ...inProgress, ...review, ...done];
}

/** Архив завершённых задач (вкладка «Завершённые»): 142 задачи */
const ARCHIVE_SIZE = 142;
const archiveTitles = [
  'Справка для Исполкома',
  'Ответ на письмо федерации',
  'Отчёт о командировке',
  'Протокол совещания',
  'Согласование сметы',
  'Подготовка пресс-релиза',
];
const archiveProjects = Object.values(projects);
const archivePeople = Object.values(people);

export function createMockTasks(today: IsoDate = todayInBishkek()) {
  counter = 400;
  const department = departmentSeeds().map((seed) => make(seed, today));
  const archive = Array.from({ length: ARCHIVE_SIZE }, (_, i) =>
    make(
      {
        title: `${archiveTitles[i % archiveTitles.length]} № ${i + 1}`,
        status: 'done' as TaskStatus,
        project: archiveProjects[i % archiveProjects.length],
        author: archivePeople[(i + 1) % archivePeople.length],
        assignee: archivePeople[i % archivePeople.length],
        dueIn: -30 - i,
      },
      today,
    ),
  );
  return { department, archive };
}
