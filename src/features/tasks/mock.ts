import { addDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { absenceOf, isAbsentOn } from './absences';
import { currentUserId, people, projects } from './directory';
import type { HistoryEntry, Person, Project, TaskDetail, TaskStatus } from './types';

export { currentUserId, people, projects };

/**
 * ЗАГЛУШКА задач до появления бэкенда: задачи из макета Figma.
 * Сроки и время событий задаются СМЕЩЕНИЕМ от сегодняшнего дня, чтобы «Просрочено 1 дн»
 * оставалось верным в любой день. Число подзадач, комментариев и переносов на карточке
 * считается из тех же списков, что открываются в задаче.
 * Имена вымышленные (см. CLAUDE.md, раздел «Данные»).
 */

type Seed = {
  title: string;
  status: TaskStatus;
  project: Project | null;
  author: Person;
  assignee?: Person;
  /** Смещение срока от сегодня в днях; null — без срока */
  dueIn: number | null;
  priority?: TaskDetail['priority'];
  fromEmail?: boolean;
  attachments?: number;
  escalationHours?: number;
  description?: string;
  knowledgeLink?: string;
  /** Подзадачи: [название, сделано, исполнитель] или число — сгенерировать */
  subtasks?: number | [string, boolean, Person | null][];
  /** Комментарии: [автор, смещение в часах назад, текст] или число — сгенерировать */
  comments?: number | [Person, number, string][];
  /** Переносы срока: [смещение «было», смещение «стало», кто] относительно срока */
  reschedules?: [number, number, Person][];
  reminderDays?: number;
};

/** Момент времени в Бишкеке: день со смещением и время HH:MM → ISO */
export const atBishkek = (day: IsoDate, time: string) => `${day}T${time}:00+06:00`;

let counter = 400;
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

const genericComments = [
  'Посмотрел, по срокам успеваем.',
  'Добавил данные из прошлогоднего отчёта.',
  'Нужна подпись генерального секретаря.',
  'Согласовал с департаментом, можно двигаться дальше.',
];

function make(seed: Seed, today: IsoDate): TaskDetail {
  counter += 1;
  const createdDay = addDays(today, -12);
  const createdAt = atBishkek(createdDay, '16:02');
  const due = seed.dueIn === null ? null : addDays(today, seed.dueIn);
  const assignee = seed.assignee ?? null;

  const subtaskCount = typeof seed.subtasks === 'number' ? seed.subtasks : 0;
  const subtaskItems = Array.isArray(seed.subtasks)
    ? seed.subtasks.map(([title, done, who]) => ({ id: nextId('s'), title, done, assignee: who }))
    : Array.from({ length: subtaskCount }, (_, i) => ({
        id: nextId('s'),
        title: `Шаг ${i + 1}`,
        done: i < Math.floor(subtaskCount / 2),
        assignee,
      }));

  const commentCount = typeof seed.comments === 'number' ? seed.comments : 0;
  const commentItems = Array.isArray(seed.comments)
    ? seed.comments.map(([author, hoursAgo, text]) => ({
        id: nextId('c'),
        author,
        at: new Date(Date.parse(atBishkek(today, '09:00')) - hoursAgo * 3_600_000).toISOString(),
        text,
      }))
    : Array.from({ length: commentCount }, (_, i) => ({
        id: nextId('c'),
        author: i % 2 === 0 ? (assignee ?? seed.author) : seed.author,
        at: atBishkek(addDays(today, -commentCount + i), '10:30'),
        text: genericComments[i % genericComments.length],
      }));

  const rescheduleLog =
    due && seed.reschedules
      ? seed.reschedules.map(([from, to, by]) => ({
          from: addDays(due, from),
          to: addDays(due, to),
          by,
        }))
      : [];

  const escalatedAt = seed.escalationHours ? atBishkek(addDays(today, -1), '14:20') : null;

  // Журнал изменений: новые сверху. Записи только добавляются
  const history: HistoryEntry[] = [];
  if (escalatedAt)
    history.push({ id: nextId('h'), kind: 'escalation', text: 'escalation', at: escalatedAt });
  const moves = rescheduleLog.slice().reverse();
  for (const [i, r] of moves.entries()) {
    history.push({
      id: nextId('h'),
      kind: 'due',
      text: `${r.from}|${r.to}`,
      at: atBishkek(addDays(createdDay, 5 + moves.length - i), '09:14'),
    });
  }
  history.push({
    id: nextId('h'),
    kind: 'created',
    text: seed.fromEmail ? 'email' : 'manual',
    at: createdAt,
  });

  // Заместитель — если исполнитель сейчас в отпуске
  const absence = absenceOf(assignee?.id, today);
  const deputy = absence && isAbsentOn(absence, today) ? absence.deputy : null;

  return {
    id: `t-${counter}`,
    code: `ЗД-2026-${String(counter).padStart(4, '0')}`,
    title: seed.title,
    status: seed.status,
    project: seed.project,
    due,
    assignee,
    author: seed.author,
    priority: seed.priority ?? 'normal',
    subtasks: subtaskItems.length,
    comments: commentItems.length,
    attachments: seed.attachments ?? 0,
    fromEmail: seed.fromEmail ?? false,
    reschedules: rescheduleLog.length,
    escalationHours: seed.escalationHours ?? null,
    deputy,
    description: seed.description ?? '',
    knowledgeLink: seed.knowledgeLink ?? null,
    subtaskItems,
    commentItems,
    history,
    rescheduleLog,
    reminderDays: seed.reminderDays ?? null,
    escalatedAt,
    source: seed.fromEmail
      ? { kind: 'email', mailbox: 'info@olympic.kg', at: createdAt }
      : { kind: 'manual' },
    department: 'Административный',
  };
}

const { ad, nb, dt, ka, me, ju } = people;
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
      reschedules: [[-3, 0, ka]],
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
      fromEmail: true,
      escalationHours: 4,
      priority: 'high',
      description:
        'Устав НОК КР действует только на русском языке. По требованию Минюста нужен официальный перевод на государственный язык до конца сентября. Перевод делает привлечённый специалист, юридическую сверку — наш юрист.',
      knowledgeLink: 'Порядок официального перевода документов',
      subtasks: [
        ['Передать текст устава переводчику', true, ad],
        ['Черновой перевод главы 1–4', true, nb],
        ['Юридическая сверка терминов', false, ju],
        ['Утверждение на Исполкоме', false, null],
      ],
      comments: [
        [ka, 70, 'Переводчик подтвердил сроки, текст передан.'],
        [ad, 52, 'Приложил глоссарий МОК к задаче.'],
        [nb, 46, 'Начал главу 3, по главам 1–2 вопросов нет.'],
        [
          nb,
          22,
          'Черновик главы 1–4 готов. Термины «Исполком» и «Генеральная ассамблея» перевёл по глоссарию МОК, нужна сверка.',
        ],
        [
          ju,
          19,
          'Посмотрю до конца недели. По статье 12 будет расхождение с формулировкой Минюста.',
        ],
      ],
      reschedules: [
        [-17, -8, ad],
        [-8, 0, nb],
      ],
      reminderDays: 2,
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
const archivePeople = [ad, nb, dt, ka, me];

export function createMockTasks(today: IsoDate = todayInBishkek()) {
  counter = 400;
  seq = 0;
  const department = departmentSeeds().map((seed) => make(seed, today));
  const archive = Array.from({ length: ARCHIVE_SIZE }, (_, i) =>
    make(
      {
        title: `${archiveTitles[i % archiveTitles.length]} № ${i + 1}`,
        status: 'done',
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
