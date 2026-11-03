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
 * ЗАГЛУШКА отпусков (до бэкенда). Даты — смещением от сегодня, как в макете:
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

let store: Absence[] = mockAbsences();

/** Все отсутствия, включая отменённые (копии) */
export const allAbsences = (): Absence[] => structuredClone(store);

/** Действующие отсутствия — по ним считаются заместители */
export const currentAbsences = (): Absence[] =>
  structuredClone(store.filter((a) => a.status === 'active'));

/** Изменить хранилище — только из features/absences/api.ts */
export const absenceStore = {
  add: (a: Absence) => {
    store.push(a);
  },
  find: (id: string) => store.find((a) => a.id === id),
};

/** Сброс заглушки (для тестов) */
export function resetAbsences(today?: IsoDate) {
  store = mockAbsences(today);
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
