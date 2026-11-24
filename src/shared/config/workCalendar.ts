/**
 * Производственный календарь Кыргызской Республики.
 *
 * Файл продублирован в web/ и mobile/ (src/shared/config/workCalendar.ts) — правьте оба.
 *
 * Источник на 2026 год: приказ Министерства труда, социального обеспечения и миграции КР
 * № 330 от 10.12.2025, приложение 1. Переносов выходных в 2026 году нет: праздник, выпавший
 * на выходной, не переносится (8 марта — воскресенье, 9 марта — рабочий день).
 * Даты Орозо айт и Курман айт ежегодно уточняются по лунному календарю.
 *
 * Как добавить год: внести в `years` по приказу Минтруда на этот год и сверить число рабочих
 * дней по месяцам с «Нормой рабочего времени» (тест в workCalendar.test.ts).
 */

export type HolidayKey =
  | 'newYearHolidays'
  | 'christmas'
  | 'womensDay'
  | 'nooruz'
  | 'mayHolidays'
  | 'constitutionDay'
  | 'victoryDay'
  | 'independenceDay'
  | 'orozoAit'
  | 'kurmanAit';

export type CalendarYear = {
  /** Нерабочие праздничные дни: 'MM-DD' → праздник */
  holidays: Record<string, HolidayKey>;
  /** Сокращённые на 1 час рабочие дни: предпраздничные и «сокращённые праздничные» */
  shortened: string[];
  /** Рабочие субботы/воскресенья по переносу */
  workingWeekends: string[];
  /** Документ, по которому внесён год */
  source: string;
  /** Внесён заранее, до приказа Минтруда: даты Орозо айт и Курман айт ожидаемые */
  preliminary?: boolean;
};

const range = (month: string, from: number, to: number, key: HolidayKey) =>
  Object.fromEntries(
    Array.from({ length: to - from + 1 }, (_, i) => [
      `${month}-${String(from + i).padStart(2, '0')}`,
      key,
    ]),
  );

/**
 * Нерабочие праздничные дни с фиксированной датой (Трудовой кодекс КР 2025 года).
 * Используются для лет, которых ещё нет в `years`.
 */
export const fixedHolidays: Record<string, HolidayKey> = {
  ...range('01', 1, 6, 'newYearHolidays'),
  '01-07': 'christmas',
  '03-08': 'womensDay',
  '03-21': 'nooruz',
  ...range('05', 1, 4, 'mayHolidays'),
  '05-05': 'constitutionDay',
  ...range('05', 6, 8, 'mayHolidays'),
  '05-09': 'victoryDay',
  '08-31': 'independenceDay',
};

export const years: Record<number, CalendarYear> = {
  2026: {
    holidays: {
      ...fixedHolidays,
      // Даты по факту 2026 года (ДУМК / объявления правительства)
      '03-20': 'orozoAit',
      '05-27': 'kurmanAit',
    },
    // 20 марта было предпраздничным сокращённым, но совпало с Орозо айт и стало выходным
    shortened: ['02-23', '04-07', '04-30', '12-31'],
    workingWeekends: [],
    source: 'Приказ Минтруда КР № 330 от 10.12.2025',
  },
  2027: {
    holidays: {
      ...fixedHolidays,
      '03-10': 'orozoAit',
      '05-17': 'kurmanAit',
    },
    shortened: ['02-23', '04-07', '04-30', '12-31'],
    workingWeekends: [],
    preliminary: true,
    source:
      'Предварительно, по правилам 2026 года; Орозо айт и Курман айт — ожидаемые даты. ' +
      'Сверить с приказом Минтруда на 2027 год',
  },
};
