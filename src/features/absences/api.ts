import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatKey } from '@/features/chat/api';
import { addJournalEntry } from '@/features/journal/store';
import {
  type Absence,
  type AbsenceKind,
  absenceStore,
  allAbsences,
  currentAbsences,
} from '@/features/tasks/absences';
import { tasksKey } from '@/features/tasks/api';
import type { Person } from '@/features/tasks/types';
import {
  addDays,
  diffDays,
  type IsoDate,
  todayInBishkek,
  workingDaysBetween,
} from '@/shared/lib/workDays';

/**
 * Оформление отпусков и командировок. Заглушка в памяти (tasks/absences.ts); с бэкендом
 * проверки те же, но решает сервер.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export type AbsenceInput = {
  kind: AbsenceKind;
  person: Person;
  from: IsoDate;
  to: IsoDate;
  deputy: Person | null;
  note: string;
};

/**
 * Почему нельзя сохранить:
 * - deputyRequired — без заместителя сохранение блокируется (приёмка 11.10);
 * - deputySelf — заместитель не может быть самим сотрудником;
 * - datesOrder — конец раньше начала;
 * - past — отсутствие целиком в прошлом;
 * - overlap — у сотрудника уже есть отсутствие в эти дни;
 * - deputyAbsent — заместитель сам отсутствует в эти дни.
 */
export type AbsenceProblem =
  | { code: 'deputyRequired' }
  | { code: 'deputySelf' }
  | { code: 'datesOrder' }
  | { code: 'past' }
  | { code: 'overlap'; with: Absence }
  | { code: 'deputyAbsent'; with: Absence };

const overlaps = (a: { from: IsoDate; to: IsoDate }, b: { from: IsoDate; to: IsoDate }) =>
  diffDays(a.from, b.to) >= 0 && diffDays(b.from, a.to) >= 0;

export function absenceProblems(
  input: AbsenceInput,
  existing: Absence[] = currentAbsences(),
  today: IsoDate = todayInBishkek(),
): AbsenceProblem[] {
  const problems: AbsenceProblem[] = [];
  if (!input.deputy) problems.push({ code: 'deputyRequired' });
  else if (input.deputy.id === input.person.id) problems.push({ code: 'deputySelf' });
  if (diffDays(input.from, input.to) < 0) {
    problems.push({ code: 'datesOrder' });
    return problems;
  }
  if (diffDays(today, input.to) < 0) problems.push({ code: 'past' });
  const own = existing.find((a) => a.person.id === input.person.id && overlaps(a, input));
  if (own) problems.push({ code: 'overlap', with: own });
  const deputyAway =
    input.deputy && existing.find((a) => a.person.id === input.deputy?.id && overlaps(a, input));
  if (deputyAway) problems.push({ code: 'deputyAbsent', with: deputyAway });
  return problems;
}

/** Рабочих дней в отсутствии — по производственному календарю КР, включая первый день */
export const absenceWorkingDays = (from: IsoDate, to: IsoDate) =>
  diffDays(from, to) < 0 ? 0 : workingDaysBetween(addDays(from, -1), to);

let seq = 0;

export class AbsenceError extends Error {
  readonly problems: AbsenceProblem[];
  constructor(problems: AbsenceProblem[]) {
    super(problems.map((p) => p.code).join(','));
    this.problems = problems;
  }
}

export function createAbsence(input: AbsenceInput, actor: string, today = todayInBishkek()) {
  const problems = absenceProblems(input, currentAbsences(), today);
  if (problems.length > 0 || !input.deputy) throw new AbsenceError(problems);
  const absence: Absence = {
    id: `abs-new-${++seq}`,
    kind: input.kind,
    person: input.person,
    from: input.from,
    to: input.to,
    deputy: input.deputy,
    note: input.note.trim(),
    status: 'active',
    createdBy: actor,
    cancellation: null,
  };
  absenceStore.add(absence);
  addJournalEntry({
    author: actor,
    action: 'absenceCreated',
    details: `${absence.person.short}: ${absence.from} – ${absence.to} · заместитель ${absence.deputy.short}`,
  });
  return structuredClone(absence);
}

/** Отменить с причиной: запись остаётся, заместитель перестаёт действовать сразу */
export function cancelAbsence(id: string, reason: string, actor: string) {
  const absence = absenceStore.find(id);
  if (!absence) throw new Error('not-found');
  if (absence.status === 'cancelled') throw new Error('wrong-status');
  if (reason.trim().length < 5) throw new Error('reason-required');
  absence.status = 'cancelled';
  absence.cancellation = { reason: reason.trim(), by: actor, at: new Date().toISOString() };
  addJournalEntry({
    author: actor,
    action: 'absenceCancelled',
    details: `${absence.person.short}: ${absence.from} – ${absence.to}`,
    reason: reason.trim(),
  });
  return structuredClone(absence);
}

export const absencesKey = ['absences'] as const;

/** Все отсутствия (с отменёнными) — для экрана; действующие — currentAbsences */
export function useAbsences() {
  return useQuery({
    queryKey: [...absencesKey, 'all'],
    queryFn: async () => allAbsences(),
  });
}

/** Действующие отсутствия — для рабочего стола и календаря */
export function useCurrentAbsences() {
  return useQuery({
    queryKey: [...absencesKey, 'current'],
    queryFn: async () => currentAbsences(),
  });
}

function useAbsenceMutation<V, R>(fn: (vars: V) => R, successMessage: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => fn(vars),
    meta: { successMessage },
    onSuccess: () => {
      // Заместители видны в задачах, чате и «Ролях и доступе»
      for (const key of [absencesKey, tasksKey, chatKey, ['staff']]) {
        client.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export const useCreateAbsence = (actor: string) =>
  useAbsenceMutation((input: AbsenceInput) => createAbsence(input, actor), 'absences.created');

export const useCancelAbsence = (actor: string) =>
  useAbsenceMutation(
    ({ id, reason }: { id: string; reason: string }) => cancelAbsence(id, reason, actor),
    'absences.cancelled',
  );
