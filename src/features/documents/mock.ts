import { people } from '@/features/tasks/directory';
import type { Person } from '@/features/tasks/types';
import {
  addDays,
  diffDays,
  type IsoDate,
  isWorkingDay,
  nextWorkingDay,
  todayInBishkek,
} from '@/shared/lib/workDays';
import { defaultLetter, type Letter, letterFingerprint } from './letter';
import type { DocHistoryEntry, DocKind, DocumentRecord, Resolution } from './types';

/**
 * ЗАГЛУШКА делопроизводства до бэкенда.
 *
 * Номера за год сквозные и без пропусков: входящие 1…896, исходящие 1…413, приказы 1…59.
 * Даты растут вместе с номером — по рабочим дням от середины января до вчера.
 * Документы, на которые ссылается База знаний (Вх. №2026-0884, Исх. №2026-0412 и др.),
 * и задачи по резолюциям совпадают с заглушками этих разделов.
 * Имена вымышленные (см. CLAUDE.md, раздел «Данные»).
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

export const mockCounts: Record<DocKind, number> = { incoming: 896, outgoing: 413, order: 59 };

/** Канцелярия (R6) регистрирует, генеральный секретарь — резолюции и подписи */
export const registrar: Person = people.ka;
export const head: Person = people.ad;

type Special = {
  title: string;
  party?: string;
  senderRef?: string;
  summary?: string;
  attachments?: string[];
  status?: DocumentRecord['status'];
  author?: Person;
  resolution?: Omit<Resolution, 'at' | 'author'> & { daysAfter?: number };
  annulment?: string;
  letter?: Letter;
};

/** Документы с содержанием — по номеру; остальные номера — архив без подробностей */
const incoming: Record<number, Special> = {
  731: {
    title: 'Приглашение на Генеральную ассамблею',
    party: 'АНОК',
    senderRef: 'ANOC/GA/2026-114',
    summary:
      'Приглашение делегации НОК Кыргызской Республики на Генеральную ассамблею АНОК. Просят подтвердить состав делегации.',
    attachments: ['programme.pdf'],
    resolution: {
      text: 'Подготовить состав делегации и согласовать со мной.',
      assignee: people.ad,
      due: '',
      taskTitle: 'Согласовать состав делегации на Генассамблею АНОК',
    },
  },
  884: {
    title: 'О предоставлении перевода устава',
    party: 'Минюст',
    senderRef: '№ 12-04/518',
    summary:
      'Министерство юстиции просит предоставить официальный перевод устава НОК КР на государственный язык.',
    attachments: ['запрос_минюст.pdf'],
    resolution: {
      text: 'Подготовить перевод устава, сверить с юристами.',
      assignee: people.nb,
      due: '',
      taskTitle: 'Перевод устава на кыргызский язык',
    },
  },
  888: {
    title: 'О составе сборной на чемпионат Азии',
    party: 'Федерация лёгкой атлетики',
    senderRef: '№ 47',
    summary: 'Федерация просит подтвердить состав сборной и сроки подачи заявки.',
    resolution: {
      text: 'Ответить федерации по составу.',
      assignee: people.ad,
      due: '',
      taskTitle: 'Ответ федерации лёгкой атлетики по составу',
    },
  },
  889: {
    title: 'О составе сборной на чемпионат Азии',
    party: 'Федерация лёгкой атлетики',
    senderRef: '№ 47',
    summary: 'Повторная регистрация того же письма.',
    annulment: 'Зарегистрировано повторно, дубль Вх. №2026-0888',
  },
  890: {
    title: 'Запрос по антидопинговой программе',
    party: 'МОК',
    senderRef: 'IOC/MED/2026-311',
    summary: 'МОК запрашивает обновлённые сведения по национальной антидопинговой программе.',
    attachments: ['request.pdf'],
    resolution: {
      text: 'Подготовить ответ, срок — по запросу.',
      assignee: people.ad,
      due: '',
      taskTitle: 'Ответить на запрос МОК по антидопинговой программе',
    },
  },
  893: {
    title: 'О проведении республиканской спартакиады',
    party: 'Минспорт',
    senderRef: '№ 03-1/2207',
    summary: 'Министерство просит направить предложения по видам спорта и срокам спартакиады.',
    attachments: ['положение_проект.docx'],
  },
  894: {
    title: 'Запрос квартальной отчётности',
    party: 'ОКС',
    senderRef: 'OCA/NOC/2026-58',
    summary: 'Олимпийский совет Азии запрашивает отчёт за третий квартал.',
    attachments: ['form_q3.xlsx'],
  },
  895: {
    title: 'Комментарии к спонсорскому соглашению',
    party: 'Kumtor Gold',
    summary: 'Комментарии партнёра к проекту спонсорского соглашения на 2026 год.',
    attachments: ['agreement_comments.docx'],
  },
  896: {
    title: 'О предоставлении спортивных объектов',
    party: 'Мэрия г. Бишкек',
    senderRef: '№ 01-12/4410',
    summary: 'Мэрия сообщает о графике предоставления спортивных объектов на зимний период.',
  },
};

const outgoing: Record<number, Special> = {
  390: {
    title: 'О календаре соревнований',
    party: 'Минспорт',
    summary: 'Направлен календарь международных соревнований с участием сборных на 2026 год.',
    attachments: ['календарь_2026.xlsx'],
  },
  412: {
    title: 'Ответ на запрос по программе солидарности',
    party: 'МОК',
    letter: {
      lang: 'en',
      templateId: 'reply',
      addressee: 'International Olympic Committee\nOlympic Solidarity\nLausanne, Switzerland',
      body: 'Dear colleague,\n\nIn reply to your request regarding the Olympic Solidarity programmes, please find enclosed the report of the National Olympic Committee of the Kyrgyz Republic for the current cycle.\n\nWe remain at your disposal for any further information.\n\nYours sincerely,',
    },
    summary: 'Ответ на запрос МОК о реализации программ Олимпийской солидарности.',
    attachments: ['solidarity_report.pdf'],
  },
  413: {
    title: 'Квартальный отчёт для ОКС',
    party: 'ОКС',
    letter: {
      lang: 'en',
      templateId: 'cover',
      addressee: 'Olympic Council of Asia\nKuwait',
      body: 'Dear colleague,\n\nPlease find enclosed the quarterly report of the National Olympic Committee of the Kyrgyz Republic for the second quarter.\n\nEnclosure: 6 pages, 1 copy.\n\nYours sincerely,',
    },
    summary: 'Отчёт НОК КР за второй квартал.',
    attachments: ['q2_report.pdf'],
  },
};

const orders: Record<number, Special> = {
  58: {
    title: 'О порядке регистрации корреспонденции',
    summary:
      'Устанавливает порядок регистрации входящей и исходящей корреспонденции и сквозную нумерацию.',
  },
  59: {
    title: 'Об утверждении графика отпусков на 2026 год',
    summary: 'Утверждён график ежегодных оплачиваемых отпусков сотрудников аппарата.',
  },
};

/** Проекты без номера */
const drafts: { kind: DocKind; special: Special; daysAgo: number }[] = [
  {
    kind: 'outgoing',
    daysAgo: 1,
    special: {
      title: 'О направлении перевода устава',
      party: 'Минюст',
      summary: 'Сопроводительное письмо к официальному переводу устава.',
      author: people.nb,
      letter: {
        lang: 'ru',
        templateId: 'cover',
        addressee: 'Министерство юстиции\nКыргызской Республики',
        body: 'Уважаемый коллега!\n\nНа Ваше письмо № 12-04/518 направляем официальный перевод устава Национального олимпийского комитета Кыргызской Республики на государственный язык.\n\nПриложение: на 18 л. в 1 экз.\n\nС уважением,',
      },
    },
  },
  {
    kind: 'outgoing',
    daysAgo: 3,
    special: {
      title: 'Подтверждение участия в Генеральной ассамблее',
      party: 'АНОК',
      summary: 'Подтверждение состава делегации НОК КР.',
      author: people.ad,
      letter: {
        lang: 'en',
        templateId: 'reply',
        addressee: 'Association of National Olympic Committees\nSecretariat',
        body: 'Dear colleague,\n\nIn reply to your letter ANOC/GA/2026-114, the National Olympic Committee of the Kyrgyz Republic confirms its participation in the General Assembly. The composition of the delegation will follow separately.\n\nYours sincerely,',
      },
    },
  },
  {
    kind: 'order',
    daysAgo: 2,
    special: {
      title: 'О командировании делегации на Генеральную ассамблею АНОК',
      summary: 'Проект приказа о командировании.',
      author: people.ka,
    },
  },
];

const archiveIncoming = [
  ['О проведении турнира', 'Федерация борьбы'],
  ['Запрос сведений о спортсменах', 'Минспорт'],
  ['О аккредитации', 'ОКС'],
  ['Приглашение на семинар', 'МОК'],
  ['О выделении квот', 'АНОК'],
  ['О согласовании календаря', 'Федерация бокса'],
] as const;

const archiveOutgoing = [
  ['О направлении сведений', 'Минспорт'],
  ['Ответ на приглашение', 'МОК'],
  ['О заявке на участие', 'ОКС'],
  ['О согласовании', 'Федерация дзюдо'],
] as const;

const archiveOrders = [
  'О командировании',
  'Об отпуске',
  'О поощрении',
  'О назначении ответственных',
];

const at = (day: IsoDate, time: string) => `${day}T${time}:00+06:00`;

/** Рабочие дни от второй недели января до вчера: на них раскладываются номера */
function workingDays(today: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = `${today.slice(0, 4)}-01-12`; diffDays(d, today) > 0; d = addDays(d, 1)) {
    if (isWorkingDay(d)) days.push(d);
  }
  return days.length ? days : [nextWorkingDay(`${today.slice(0, 4)}-01-12`)];
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

function entry(
  kind: DocHistoryEntry['kind'],
  when: string,
  by: Person,
  text = '',
): DocHistoryEntry {
  return { id: nextId('dh'), kind, at: when, by, text };
}

function build(
  kind: DocKind,
  number: number | null,
  date: IsoDate,
  year: number,
  special: Special | null,
  archive: { title: string; party: string | null },
): DocumentRecord {
  const author = special?.author ?? (kind === 'incoming' ? registrar : people.ka);
  const time = at(date, '10:15');
  const history: DocHistoryEntry[] = [];
  let status: DocumentRecord['status'];
  let resolution: Resolution | null = null;

  if (number === null) {
    status = 'draft';
    history.push(entry('created', time, author));
  } else if (kind === 'incoming') {
    history.push(entry('registered', time, author));
    if (special?.resolution) {
      const { daysAfter = 0, ...rest } = special.resolution;
      const resolvedAt = at(addDays(date, daysAfter), '15:40');
      resolution = { ...rest, author: head, at: resolvedAt };
      history.push(entry('resolution', resolvedAt, head, rest.text));
      status = 'inWork';
    } else {
      // Свежие письма ждут резолюции, архив — исполнен
      status = special ? 'registered' : 'done';
      if (!special) history.push(entry('done', at(addDays(date, 5), '12:00'), registrar));
    }
  } else {
    status = kind === 'outgoing' ? 'sent' : 'signed';
    history.push(entry(kind === 'outgoing' ? 'sent' : 'signed', time, head));
  }

  let annulment: DocumentRecord['annulment'] = null;
  if (special?.annulment) {
    const when = at(date, '16:05');
    annulment = { reason: special.annulment, by: registrar, at: when };
    history.push(entry('annulled', when, registrar, special.annulment));
    status = 'annulled';
  }

  return {
    id: number === null ? nextId(`doc-${kind}-draft`) : `doc-${kind}-${year}-${number}`,
    kind,
    status,
    seq: number,
    year,
    date,
    title: special?.title ?? archive.title,
    party: kind === 'order' ? null : (special?.party ?? archive.party),
    senderRef: special?.senderRef ?? null,
    summary: special?.summary ?? '',
    attachments: special?.attachments ?? [],
    author,
    signer: kind === 'incoming' || number === null ? null : head,
    resolution,
    annulment,
    history: history.reverse(),
    letter: special?.letter ?? null,
    fingerprint: null,
  };
}

/** Заглушка на сегодня: номера и даты — от сегодняшнего дня */
export function createMockDocuments(
  today: IsoDate = todayInBishkek(),
  dueOf: (taskTitle: string) => IsoDate | null = () => null,
): DocumentRecord[] {
  seq = 0;
  const year = Number(today.slice(0, 4));
  const days = workingDays(today);
  const dateOf = (n: number, total: number) =>
    days[Math.min(days.length - 1, Math.floor(((n - 1) / total) * days.length))];

  const series = (
    kind: DocKind,
    specials: Record<number, Special>,
    archive: (n: number) => { title: string; party: string | null },
  ) =>
    Array.from({ length: mockCounts[kind] }, (_, i) => {
      const n = i + 1;
      return build(kind, n, dateOf(n, mockCounts[kind]), year, specials[n] ?? null, archive(n));
    });

  const docs = [
    ...series('incoming', incoming, (n) => {
      const [title, party] = archiveIncoming[n % archiveIncoming.length];
      return { title, party };
    }),
    ...series('outgoing', outgoing, (n) => {
      const [title, party] = archiveOutgoing[n % archiveOutgoing.length];
      return { title, party };
    }),
    ...series('order', orders, (n) => ({
      title: archiveOrders[n % archiveOrders.length],
      party: null,
    })),
    ...drafts.map((d) =>
      build(d.kind, null, addDays(today, -d.daysAgo), year, d.special, {
        title: d.special.title,
        party: d.special.party ?? null,
      }),
    ),
  ];

  // Отправленные исходящие с текстом — неизменяемы, у них отпечаток содержания
  for (const doc of docs) {
    if (doc.kind !== 'outgoing') continue;
    if (doc.seq !== null && !doc.letter) doc.letter = defaultLetter(doc.party, doc.summary);
    if (doc.seq !== null && doc.letter) {
      doc.fingerprint = letterFingerprint({
        number: `Исх. №${doc.year}-${String(doc.seq).padStart(4, '0')}`,
        date: doc.date,
        title: doc.title,
        letter: doc.letter,
        signer: doc.signer?.short ?? '',
      });
    }
  }

  // Срок в резолюции — срок задачи по ней (из заглушки задач)
  for (const doc of docs) {
    if (doc.resolution?.taskTitle) {
      doc.resolution.due = dueOf(doc.resolution.taskTitle) ?? addDays(doc.date, 10);
    }
  }
  return docs;
}
