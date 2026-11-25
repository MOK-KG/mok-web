import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chatKey } from '@/features/chat/api';
import {
  type Absence,
  type AbsenceKind,
  currentAbsences,
  setAbsenceCache,
} from '@/features/tasks/absences';
import { type ApiPerson, tasksKey, toPerson } from '@/features/tasks/api';
import type { Person } from '@/features/tasks/types';
import { api } from '@/shared/api/client';
import {
  addDays,
  diffDays,
  type IsoDate,
  todayInBishkek,
  workingDaysBetween,
} from '@/shared/lib/workDays';

/**
 * Оформление отпусков и командировок — API бэкенда (mok-backend, apps/accounts,
 * /api/staff/absences). Проверки absenceProblems — те же, что на сервере: экран показывает их
 * сразу, решает сервер. В тестах — подставной сервер testing/server.ts.
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

export class AbsenceError extends Error {
  readonly problems: AbsenceProblem[];
  constructor(problems: AbsenceProblem[]) {
    super(problems.map((p) => p.code).join(','));
    this.problems = problems;
  }
}

// --- Формат бэкенда (mok-backend, apps/accounts: /api/staff/absences) -----------------------

export type ApiAbsence = Omit<Absence, 'person' | 'deputy' | 'from' | 'to'> & {
  person: ApiPerson;
  deputy: ApiPerson;
  dateFrom: IsoDate;
  dateTo: IsoDate;
};

export const toAbsence = (a: ApiAbsence): Absence => ({
  id: String(a.id),
  kind: a.kind,
  person: toPerson(a.person),
  from: a.dateFrom,
  to: a.dateTo,
  deputy: toPerson(a.deputy),
  note: a.note,
  status: a.status,
  createdBy: a.createdBy,
  cancellation: a.cancellation,
});

/**
 * Все отсутствия (с отменёнными). Ответ кладётся и в кэш синхронных помощников
 * (absenceOf, deputyFor из tasks/absences.ts)
 */
export async function fetchAbsences(): Promise<Absence[]> {
  const list = (await api.get<ApiAbsence[]>('/staff/absences')).map(toAbsence);
  setAbsenceCache(list);
  return list;
}

/**
 * Оформить отсутствие. Проверки (absenceProblems) повторяет сервер; нарушение — AbsenceError
 * с проблемами, найденными на клиенте, или ApiError absence_invalid
 */
export async function createAbsence(input: AbsenceInput, today = todayInBishkek()) {
  const problems = absenceProblems(input, currentAbsences(), today);
  if (problems.length > 0 || !input.deputy) throw new AbsenceError(problems);
  return toAbsence(
    await api.post<ApiAbsence>('/staff/absences', {
      kind: input.kind,
      personId: input.person.id,
      dateFrom: input.from,
      dateTo: input.to,
      deputyId: input.deputy.id,
      note: input.note.trim(),
    }),
  );
}

export async function updateAbsence(id: string, input: AbsenceInput, today = todayInBishkek()) {
  const others = currentAbsences().filter((a) => a.id !== id);
  const problems = absenceProblems(input, others, today).filter(
    (p) => p.code !== 'past' || diffDays(today, input.to) < 0,
  );
  if (problems.length > 0 || !input.deputy) throw new AbsenceError(problems);
  return toAbsence(
    await api.patch<ApiAbsence>(`/staff/absences/${id}`, {
      kind: input.kind,
      dateFrom: input.from,
      dateTo: input.to,
      deputyId: input.deputy.id,
      note: input.note.trim(),
    }),
  );
}

/** Отменить с причиной: запись остаётся, заместитель перестаёт действовать сразу */
export async function cancelAbsence(id: string, reason: string) {
  return toAbsence(
    await api.post<ApiAbsence>(`/staff/absences/${id}/cancel`, { reason: reason.trim() }),
  );
}

export const absencesKey = ['absences'] as const;

function useAbsenceQuery<T>(select: (list: Absence[]) => T) {
  return useQuery({ queryKey: absencesKey, queryFn: fetchAbsences, select });
}

const all = (list: Absence[]) => list;
const active = (list: Absence[]) => list.filter((a) => a.status === 'active');

/** Все отсутствия (с отменёнными) — для экрана; действующие — useCurrentAbsences */
export const useAbsences = () => useAbsenceQuery(all);

/**
 * Действующие отсутствия — для рабочего стола, календаря, задач. Экран, который зовёт
 * синхронные помощники (absenceOf, deputyFor), подписывается этим хуком: так он перерисуется,
 * когда отсутствия загрузятся
 */
export const useCurrentAbsences = () => useAbsenceQuery(active);

/** Кого можно выбрать сотрудником и заместителем: работающие сотрудники аппарата */
export function useAbsencePeople() {
  return useQuery({
    queryKey: [...absencesKey, 'people'],
    queryFn: async () =>
      (await api.get<{ people: ApiPerson[] }>('/staff/people')).people.map(toPerson),
    staleTime: 60_000,
  });
}

function useAbsenceMutation<V, R>(fn: (vars: V) => Promise<R>, successMessage: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta: { successMessage },
    onSuccess: () => {
      // Заместители видны в задачах, чате и «Ролях и доступе»
      for (const key of [absencesKey, tasksKey, chatKey, ['staff']]) {
        client.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export const useCreateAbsence = () =>
  useAbsenceMutation((input: AbsenceInput) => createAbsence(input), 'absences.created');

export const useUpdateAbsence = () =>
  useAbsenceMutation(
    ({ id, input }: { id: string; input: AbsenceInput }) => updateAbsence(id, input),
    'absences.updated',
  );

export const useCancelAbsence = () =>
  useAbsenceMutation(
    ({ id, reason }: { id: string; reason: string }) => cancelAbsence(id, reason),
    'absences.cancelled',
  );
