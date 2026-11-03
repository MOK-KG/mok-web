import type { IsoDate } from '@/shared/lib/workDays';

/**
 * Исходящее письмо на фирменном бланке (экран S-07, шаблоны — раздел H админки).
 * Бланк печатается на языке письма, а не интерфейса: русский, кыргызский или английский.
 * После отправки письмо неизменяемо: у него вычислен отпечаток содержания (ТЗ, раздел 09 —
 * задел под электронную подпись).
 *
 * Логотип и реквизиты — ЗАГЛУШКА: настоящий логотип НОК КР и адрес задаются в настройках
 * бланка (админка, раздел H). Изображения встраиваются в файл, а не грузятся по ссылке
 * (приёмка 11.14).
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type LetterLang = 'ru' | 'ky' | 'en';

export const letterLangs: LetterLang[] = ['ru', 'ky', 'en'];

export type Letter = {
  lang: LetterLang;
  templateId: LetterTemplateId;
  /** Кому: организация, должность, имя — по строкам */
  addressee: string;
  body: string;
};

/** Шапка бланка и подписи на языке письма */
export const letterhead: Record<
  LetterLang,
  {
    org: string;
    orgShort: string;
    contacts: string;
    number: string;
    dated: string;
    draft: string;
    /** Приставка к теме: «Re:» у английского; русская тема и так начинается с «О …» */
    subject: string;
    signerPosition: string;
    facsimile: string;
  }
> = {
  ru: {
    org: 'Национальный олимпийский комитет Кыргызской Республики',
    orgShort: 'НОК КР',
    contacts: 'г. Бишкек · olympic.kg · info@olympic.kg',
    number: 'Исх. №',
    dated: 'от',
    draft: 'проект — номер будет присвоен при отправке',
    subject: '',
    signerPosition: 'Генеральный секретарь',
    facsimile: 'факсимиле',
  },
  ky: {
    org: 'Кыргыз Республикасынын Улуттук олимпиадалык комитети',
    orgShort: 'КР УОК',
    contacts: 'Бишкек ш. · olympic.kg · info@olympic.kg',
    number: 'Чыгыш №',
    dated: '',
    draft: 'долбоор — номер жөнөтүүдө берилет',
    subject: '',
    signerPosition: 'Башкы катчы',
    facsimile: 'факсимиле',
  },
  en: {
    org: 'National Olympic Committee of the Kyrgyz Republic',
    orgShort: 'NOC KR',
    contacts: 'Bishkek · olympic.kg · info@olympic.kg',
    number: 'Ref. No.',
    dated: 'of',
    draft: 'draft — the number is issued when sent',
    subject: 'Re:',
    signerPosition: 'Secretary General',
    facsimile: 'facsimile',
  },
};

export type LetterTemplateId = 'standard' | 'reply' | 'cover';

export const letterTemplateIds: LetterTemplateId[] = ['standard', 'reply', 'cover'];

/** Заготовки текста шаблонов; [тема] и [номер] заменяются при выборе шаблона */
export const letterTemplates: Record<LetterTemplateId, Record<LetterLang, string>> = {
  standard: {
    ru: 'Уважаемый коллега!\n\nНациональный олимпийский комитет Кыргызской Республики выражает Вам своё уважение и сообщает следующее.\n\n[текст письма]\n\nС уважением,',
    ky: 'Урматтуу кесиптеш!\n\nКыргыз Республикасынын Улуттук олимпиадалык комитети Сизге өзүнүн урматын билдирет жана төмөнкүнү кабарлайт.\n\n[каттын тексти]\n\nУрматтоо менен,',
    en: 'Dear colleague,\n\nThe National Olympic Committee of the Kyrgyz Republic presents its compliments and wishes to inform you of the following.\n\n[letter text]\n\nYours sincerely,',
  },
  reply: {
    ru: 'Уважаемый коллега!\n\nНа Ваше письмо [номер] сообщаем следующее.\n\n[ответ]\n\nС уважением,',
    ky: 'Урматтуу кесиптеш!\n\nСиздин [номер] катыңызга жооп катары төмөнкүнү билдиребиз.\n\n[жооп]\n\nУрматтоо менен,',
    en: 'Dear colleague,\n\nIn reply to your letter [номер], please note the following.\n\n[reply]\n\nYours sincerely,',
  },
  cover: {
    ru: 'Уважаемый коллега!\n\nНаправляем Вам [что направляем].\n\nПриложение: на [N] л. в 1 экз.\n\nС уважением,',
    ky: 'Урматтуу кесиптеш!\n\nСизге [эмне жиберилет] жиберебиз.\n\nТиркеме: [N] барак, 1 нускада.\n\nУрматтоо менен,',
    en: 'Dear colleague,\n\nPlease find enclosed [enclosure].\n\nEnclosure: [N] pages, 1 copy.\n\nYours sincerely,',
  },
};

const monthNames: Record<LetterLang, string[]> = {
  ru: [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ],
  // Притяжательная форма: «2026-жылдын 3-ноябры»
  ky: [
    'январы',
    'февралы',
    'марты',
    'апрели',
    'майы',
    'июну',
    'июлу',
    'августу',
    'сентябры',
    'октябры',
    'ноябры',
    'декабры',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/**
 * Дата на бланке — на языке письма, не интерфейса: «3 ноября 2026 г.»,
 * «2026-жылдын 3-ноябры», «3 November 2026»
 */
export function letterDate(date: IsoDate, lang: LetterLang): string {
  const [y, m, d] = date.split('-').map(Number);
  const month = monthNames[lang][m - 1];
  if (lang === 'ky') return `${y}-жылдын ${d}-${month}`;
  if (lang === 'en') return `${d} ${month} ${y}`;
  return `${d} ${month} ${y} г.`;
}

/** Строка «Исх. №2026-0414 от 3 ноября 2026 г.» на языке письма; у проекта — пометка */
export function letterRef(number: string | null, date: IsoDate, lang: LetterLang): string {
  const h = letterhead[lang];
  if (!number) return `${h.number} ____ · ${h.draft}`;
  const n = number.replace(/^Исх\. №/, '');
  if (lang === 'ky') return `${letterDate(date, lang)} · ${h.number}${n}`;
  return `${h.number}${n} ${h.dated} ${letterDate(date, lang)}`;
}

/** FNV-1a 32 бита → 8 hex; на бэкенде — SHA-256 */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Отпечаток содержания отправленного письма: меняется от любой правки */
export function letterFingerprint(parts: {
  number: string | null;
  date: IsoDate;
  title: string;
  letter: Letter;
  signer: string;
}): string {
  const { number, date, title, letter, signer } = parts;
  return fnv(
    [number ?? '', date, title, letter.lang, letter.addressee, letter.body, signer].join('\n'),
  );
}

/** Письмо по умолчанию для документа без текста (архив): тема и содержание */
export const defaultLetter = (
  party: string | null,
  summary: string,
  lang: LetterLang = 'ru',
): Letter => ({
  lang,
  templateId: 'standard',
  addressee: party ?? '',
  body: summary,
});

/** Тема письма на бланке: как ввели, с приставкой языка */
export const letterSubject = (title: string, lang: LetterLang) =>
  letterhead[lang].subject ? `${letterhead[lang].subject} ${title}` : title;

/** Номер на языке бланка: «Исх. №2026-0414» → «Ref. No.2026-0414» */
export const localNumber = (number: string, lang: LetterLang) =>
  number.replace(/^Исх\. №/, letterhead[lang].number);

/**
 * Сменить язык письма. Текст заменяется заготовкой, только если его ещё не правили
 * (он совпадает с шаблоном на прежнем языке) — написанное не теряется.
 */
export function switchLang(letter: Letter, lang: LetterLang): Letter {
  const untouched =
    letter.body.trim() === '' || letter.body === fillTemplate(letter.templateId, letter.lang);
  return { ...letter, lang, body: untouched ? fillTemplate(letter.templateId, lang) : letter.body };
}

/** Подставить тему и номер в заготовку шаблона */
export const fillTemplate = (id: LetterTemplateId, lang: LetterLang, replyTo?: string) =>
  letterTemplates[id][lang].replace('[номер]', replyTo ?? '[номер]');
