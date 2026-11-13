import { addDays, diffDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { people } from './directory';
import type { Person } from './types';

/**
 * Отсутствия сотрудников: отпуск и командировка (ТЗ, экран S-29). Заместитель обязателен —
 * от него зависят сроки задач и уведомления. Права заместителя не хранятся отдельно:
 * они следуют из дат отсутствия и прекращаются в дату окончания сами (приёмка 11.11).
 * Отсутствие не удаляется — отменяется с причиной.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type AbsenceKind = 'vacation' | 'trip';

export const absenceKinds: AbsenceKind[] = ['vacation', 'trip'];

export type Absence = {
  id: string;
  kind: AbsenceKind;
  person: Person;
  from: IsoDate;
  to: IsoDate;
  deputy: Person;
  note: string;
  status: 'active' | 'cancelled';
  /** Кто оформил: короткое имя */
  createdBy: string;
  cancellation: { reason: string; by: string; at: string } | null;
};

/**
 * Данные подставного сервера для тестов (features/absences/testing/server.ts) и заглушки чата.
 * Даты — смещением от сегодня, как в макете:
 * Н. Бакиров в отпуске до +13 дней, Д. Токтосунова — через 5 дней на неделю,
 * М. Эсенова — до +20 дней. Заместитель у всех — К. Асанов.
 */
export function mockAbsences(today: IsoDate = todayInBishkek()): Absence[] {
  const base = { kind: 'vacation' as const, note: '', status: 'active' as const };
  const by = { createdBy: people.ka.short, cancellation: null };
  return [
    {
      id: 'abs-nb',
      ...base,
      ...by,
      person: people.nb,
      from: addDays(today, -2),
      to: addDays(today, 13),
      deputy: people.ka,
    },
    {
      id: 'abs-dt',
      ...base,
      ...by,
      person: people.dt,
      from: addDays(today, 5),
      to: addDays(today, 11),
      deputy: people.ka,
    },
    {
      id: 'abs-me',
      ...base,
      ...by,
      person: people.me,
      from: addDays(today, -1),
      to: addDays(today, 20),
      deputy: people.ka,
    },
  ];
}

/**
 * Последние загруженные с бэкенда отсутствия (features/absences/api.ts наполняет кэш при каждом
 * запросе). Синхронные помощники ниже читают его — их зовут задачи, чат, календарь; экраны,
 * которым нужно перерисоваться после загрузки, подписываются хуком useCurrentAbsences.
 */
let cache: Absence[] = [];

/** Все загруженные отсутствия, включая отменённые (копии) */
export const allAbsences = (): Absence[] => structuredClone(cache);

/** Действующие отсутствия — по ним считаются заместители */
export const currentAbsences = (): Absence[] =>
  structuredClone(cache.filter((a) => a.status === 'active'));

/** Заменить кэш — только из features/absences/api.ts (ответ бэкенда) и подставного сервера */
export function setAbsenceCache(absences: Absence[]) {
  cache = absences;
}

/** Отпуск сотрудника, который идёт сейчас или начнётся позже (ближайший) */
export function absenceOf(
  personId: string | undefined,
  today: IsoDate = todayInBishkek(),
  absences: Absence[] = currentAbsences(),
): Absence | null {
  if (!personId) return null;
  return (
    absences
      .filter((a) => a.person.id === personId && diffDays(today, a.to) >= 0)
      .sort((a, b) => a.from.localeCompare(b.from))[0] ?? null
  );
}

/** Отсутствует ли сотрудник в этот день */
export const isAbsentOn = (absence: Pick<Absence, 'from' | 'to'>, day: IsoDate) =>
  diffDays(absence.from, day) >= 0 && diffDays(day, absence.to) >= 0;

/** Заместитель сотрудника на этот день; null — сотрудник на месте */
export function deputyFor(personId: string | undefined, day: IsoDate = todayInBishkek()) {
  const absence = absenceOf(personId, day);
  return absence && isAbsentOn(absence, day) ? absence.deputy : null;
}
