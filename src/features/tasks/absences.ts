import { addDays, diffDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import { people } from './directory';
import type { Person } from './types';

export type Absence = {
  person: Person;
  from: IsoDate;
  to: IsoDate;
  deputy: Person;
};

/**
 * ЗАГЛУШКА отпусков (до бэкенда). Даты — смещением от сегодня, как в макете:
 * Н. Бакиров в отпуске до +13 дней, Д. Токтосунова — через 5 дней на неделю,
 * М. Эсенова — до +20 дней. Заместитель у всех — К. Асанов.
 */
export function mockAbsences(today: IsoDate = todayInBishkek()): Absence[] {
  return [
    { person: people.nb, from: addDays(today, -2), to: addDays(today, 13), deputy: people.ka },
    { person: people.dt, from: addDays(today, 5), to: addDays(today, 11), deputy: people.ka },
    { person: people.me, from: addDays(today, -1), to: addDays(today, 20), deputy: people.ka },
  ];
}

/** Отпуск сотрудника, который идёт сейчас или начнётся позже (ближайший) */
export function absenceOf(
  personId: string | undefined,
  today: IsoDate = todayInBishkek(),
  absences: Absence[] = mockAbsences(today),
): Absence | null {
  if (!personId) return null;
  return (
    absences
      .filter((a) => a.person.id === personId && diffDays(today, a.to) >= 0)
      .sort((a, b) => a.from.localeCompare(b.from))[0] ?? null
  );
}

/** Отсутствует ли сотрудник в этот день */
export const isAbsentOn = (absence: Absence, day: IsoDate) =>
  diffDays(absence.from, day) >= 0 && diffDays(day, absence.to) >= 0;
