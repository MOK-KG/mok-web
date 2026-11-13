import { beforeEach, describe, expect, it } from 'vitest';
import { journalServer } from '../journal/testing/server';
import { currentAbsences, deputyFor } from '../tasks/absences';
import { fetchBoard } from '../tasks/api';
import { people } from '../tasks/directory';
import {
  type AbsenceInput,
  absenceProblems,
  absenceWorkingDays,
  cancelAbsence,
  createAbsence,
  fetchAbsences,
} from './api';
import { installAbsencesServer } from './testing/server';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

const input = (patch: Partial<AbsenceInput> = {}): AbsenceInput => ({
  kind: 'vacation',
  person: people.ad,
  from: '2026-09-21',
  to: '2026-09-25',
  deputy: people.ju,
  note: '',
  ...patch,
});

const codes = (i: AbsenceInput) => absenceProblems(i, currentAbsences(), TODAY).map((p) => p.code);

// Подставной бэкенд с «сегодня» макета; кэш помощников (deputyFor) — его данные
beforeEach(() => {
  installAbsencesServer({ today: TODAY });
});

const lastJournal = () => journalServer.entries.at(-1);

describe('оформление отсутствия', () => {
  it('без заместителя сохранить нельзя (приёмка 11.10)', async () => {
    expect(codes(input({ deputy: null }))).toContain('deputyRequired');
    await expect(createAbsence(input({ deputy: null }), TODAY)).rejects.toThrow('deputyRequired');
  });

  it('с заместителем — сохраняется на сервере, журнал пишет сервер', async () => {
    expect(codes(input())).toEqual([]);
    const a = await createAbsence(input(), TODAY);
    expect(a).toMatchObject({ status: 'active', person: { id: people.ad.id }, from: '2026-09-21' });
    expect(a.deputy.short).toBe('Ю. Ведерникова');
    expect(lastJournal()).toMatchObject({ action: 'absenceCreated' });
    expect((await fetchAbsences()).map((x) => x.id)).toContain(a.id);
  });

  it('проверки дат и заместителя', () => {
    expect(codes(input({ deputy: people.ad }))).toContain('deputySelf');
    expect(codes(input({ from: '2026-09-25', to: '2026-09-21' }))).toEqual(['datesOrder']);
    expect(codes(input({ from: '2026-09-01', to: '2026-09-04' }))).toContain('past');
    // Н. Бакиров уже в отпуске до 22 сентября; К. Асанов — заместитель у всех, сам на месте
    expect(codes(input({ person: people.nb, deputy: people.ka }))).toContain('overlap');
    // Д. Токтосунова в отпуске 14–20 сентября — заместителем на эти дни быть не может
    expect(codes(input({ from: '2026-09-15', to: '2026-09-18', deputy: people.dt }))).toContain(
      'deputyAbsent',
    );
  });

  it('рабочие дни — по календарю КР, включая первый день', () => {
    expect(absenceWorkingDays('2026-09-21', '2026-09-25')).toBe(5);
    expect(absenceWorkingDays('2026-09-25', '2026-09-28')).toBe(2);
    expect(absenceWorkingDays('2026-08-31', '2026-08-31')).toBe(0);
  });
});

describe('заместитель по датам (приёмка 11.11)', () => {
  it('действует только в дни отсутствия и прекращается сам', async () => {
    await createAbsence(input(), TODAY);
    await fetchAbsences();
    expect(deputyFor(people.ad.id, '2026-09-20')).toBeNull();
    expect(deputyFor(people.ad.id, '2026-09-21')?.id).toBe(people.ju.id);
    expect(deputyFor(people.ad.id, '2026-09-25')?.id).toBe(people.ju.id);
    expect(deputyFor(people.ad.id, '2026-09-26')).toBeNull();
  });

  it('отмена — запись остаётся, заместитель больше не действует', async () => {
    const a = await createAbsence(input({ from: TODAY }), TODAY);
    await fetchAbsences();
    expect(deputyFor(people.ad.id, TODAY)?.id).toBe(people.ju.id);
    await expect(cancelAbsence(a.id, 'нет')).rejects.toMatchObject({ code: 'reason_required' });
    const cancelled = await cancelAbsence(a.id, 'Отпуск перенесён');
    expect(cancelled.cancellation).toMatchObject({ reason: 'Отпуск перенесён', by: 'А. Дуйшеев' });
    const all = await fetchAbsences();
    expect(all.find((x) => x.id === a.id)?.status).toBe('cancelled');
    expect(deputyFor(people.ad.id, TODAY)).toBeNull();
    expect(lastJournal()).toMatchObject({
      action: 'absenceCancelled',
      reason: 'Отпуск перенесён',
    });
  });
});

describe('заместитель в задачах', () => {
  it('приходит с бэкенда: исполнитель в отпуске сегодня, задача не готова', async () => {
    const { tasks } = await fetchBoard();
    const open = tasks.filter((t) => t.assignee?.id === people.nb.id && t.status !== 'done');
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((t) => t.deputy?.id === people.ka.id)).toBe(true);
    const done = tasks.filter((t) => t.status === 'done');
    expect(done.every((t) => t.deputy === null)).toBe(true);
    const present = tasks.filter((t) => t.assignee?.id === people.ju.id);
    expect(present.every((t) => t.deputy === null)).toBe(true);
  });
});
