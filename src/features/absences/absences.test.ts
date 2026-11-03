import { beforeEach, describe, expect, it } from 'vitest';
import { journalEntries, resetJournal } from '../journal/store';
import { currentAbsences, deputyFor, resetAbsences } from '../tasks/absences';
import { people } from '../tasks/directory';
import {
  type AbsenceInput,
  absenceProblems,
  absenceWorkingDays,
  cancelAbsence,
  createAbsence,
} from './api';

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

beforeEach(() => {
  resetAbsences(TODAY);
  resetJournal();
});

describe('оформление отсутствия', () => {
  it('без заместителя сохранить нельзя (приёмка 11.10)', () => {
    expect(codes(input({ deputy: null }))).toContain('deputyRequired');
    expect(() => createAbsence(input({ deputy: null }), 'А. Дуйшеев', TODAY)).toThrow(
      'deputyRequired',
    );
  });

  it('с заместителем — сохраняется и пишется в журнал', () => {
    expect(codes(input())).toEqual([]);
    const a = createAbsence(input(), 'А. Дуйшеев', TODAY);
    expect(a.status).toBe('active');
    expect(journalEntries().at(-1)).toMatchObject({ action: 'absenceCreated' });
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
  it('действует только в дни отсутствия и прекращается сам', () => {
    createAbsence(input(), 'А. Дуйшеев', TODAY);
    expect(deputyFor(people.ad.id, '2026-09-20')).toBeNull();
    expect(deputyFor(people.ad.id, '2026-09-21')?.id).toBe(people.ju.id);
    expect(deputyFor(people.ad.id, '2026-09-25')?.id).toBe(people.ju.id);
    expect(deputyFor(people.ad.id, '2026-09-26')).toBeNull();
  });

  it('отмена — запись остаётся, заместитель больше не действует', () => {
    const a = createAbsence(input({ from: TODAY }), 'А. Дуйшеев', TODAY);
    expect(deputyFor(people.ad.id, TODAY)?.id).toBe(people.ju.id);
    expect(() => cancelAbsence(a.id, 'нет', 'А. Дуйшеев')).toThrow('reason-required');
    cancelAbsence(a.id, 'Отпуск перенесён', 'А. Дуйшеев');
    expect(deputyFor(people.ad.id, TODAY)).toBeNull();
    expect(journalEntries().at(-1)).toMatchObject({
      action: 'absenceCancelled',
      reason: 'Отпуск перенесён',
    });
  });
});
