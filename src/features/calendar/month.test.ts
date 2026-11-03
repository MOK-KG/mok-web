import { describe, expect, it } from 'vitest';
import { mockAbsences } from '../tasks/absences';
import { currentUserId } from '../tasks/directory';
import { createMockTasks } from '../tasks/mock';
import {
  type CalendarLayer,
  calendarLayers,
  dayType,
  eventsByDay,
  holidayRanges,
  loadLevel,
  monthGrid,
  monthLoad,
  monthNorm,
  shiftMonth,
  weekdayOf,
} from './month';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

describe('сетка месяца', () => {
  it('недели с понедельника, соседние месяцы дополняют края', () => {
    const weeks = monthGrid('2026-09');
    // 1 сентября 2026 — вторник
    expect(weeks[0][0]).toBe('2026-08-31');
    expect(weeks.at(-1)?.at(-1)).toBe('2026-10-04');
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7 && weekdayOf(w[0]) === 0)).toBe(true);
  });

  it('февраль 2027 с понедельника — ровно 4 недели', () => {
    expect(monthGrid('2027-02')).toHaveLength(4);
  });

  it('переход через год', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', -14)).toBe('2025-07');
  });
});

describe('норма месяца по календарю КР', () => {
  it('сентябрь 2026: 22 рабочих дня, 176 часов', () => {
    expect(monthNorm('2026-09')).toMatchObject({ workingDays: 22, hours: 176, official: true });
  });

  it('май 2026: 14 рабочих дней, праздники 1–9 и 27 мая', () => {
    const may = monthNorm('2026-05');
    expect(may.workingDays).toBe(14);
    expect(may.holidays.map((h) => h.date.slice(8))).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
      '08',
      '09',
      '27',
    ]);
  });

  it('праздники подряд — одним отрезком', () => {
    expect(holidayRanges(monthNorm('2026-05').holidays)).toEqual([
      { holiday: 'mayHolidays', from: '2026-05-01', to: '2026-05-04' },
      { holiday: 'constitutionDay', from: '2026-05-05', to: '2026-05-05' },
      { holiday: 'mayHolidays', from: '2026-05-06', to: '2026-05-08' },
      { holiday: 'victoryDay', from: '2026-05-09', to: '2026-05-09' },
      { holiday: 'kurmanAit', from: '2026-05-27', to: '2026-05-27' },
    ]);
  });

  it('декабрь 2026: 31-е — сокращённый день, норма на час меньше', () => {
    const dec = monthNorm('2026-12');
    expect(dec.shortened).toEqual(['2026-12-31']);
    expect(dec.hours).toBe(dec.workingDays * 8 - 1);
  });

  it('год без приказа Минтруда помечается', () => {
    expect(monthNorm('2027-01').official).toBe(false);
  });

  it('тип дня', () => {
    expect(dayType('2026-03-21')).toEqual({ type: 'holiday', holiday: 'nooruz' });
    expect(dayType('2026-09-12')).toEqual({ type: 'weekend' });
  });
});

describe('события по дням', () => {
  const { department } = createMockTasks(TODAY);
  const days = monthGrid('2026-09').flat();
  const all = new Set<CalendarLayer>(calendarLayers);

  it('сроки незакрытых задач — в свой день, готовые не показываются', () => {
    const events = eventsByDay(days, department, [], all, currentUserId);
    const shown = [...events.values()].flatMap((e) => e.deadlines);
    expect(shown.every((t) => t.status !== 'done' && t.due && days.includes(t.due))).toBe(true);
    expect(events.get('2026-09-08')?.deadlines.map((t) => t.title)).toContain(
      'Ответить на запрос МОК по антидопинговой программе',
    );
  });

  it('слой «Мои» без «Департамента» — только мои задачи', () => {
    const events = eventsByDay(days, department, [], new Set(['mine']), currentUserId);
    const shown = [...events.values()].flatMap((e) => e.deadlines);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((t) => t.assignee?.id === currentUserId)).toBe(true);
  });

  it('отпуска — в каждый день отпуска, без слоя — нигде', () => {
    const absences = mockAbsences(TODAY);
    const on = eventsByDay(days, [], absences, all, currentUserId);
    expect(on.get(TODAY)?.absences.map((a) => a.person.short)).toEqual([
      'Н. Бакиров',
      'М. Эсенова',
    ]);
    const twice = eventsByDay([TODAY, TODAY], [], absences, all, currentUserId);
    expect(twice.get(TODAY)?.absences).toHaveLength(2);
    const off = eventsByDay(days, [], absences, new Set(['mine']), currentUserId);
    expect([...off.values()].every((e) => e.absences.length === 0)).toBe(true);
  });
});

describe('загрузка (S-04)', () => {
  const { department } = createMockTasks(TODAY);
  const days = monthGrid('2026-09').flat();
  const all = new Set<CalendarLayer>(calendarLayers);

  it('срок во время отпуска исполнителя — конфликт, даже если слой отпусков скрыт', () => {
    const absences = mockAbsences(TODAY);
    // Н. Бакиров в отпуске до 22 сентября, «Перевод устава» — срок 18 сентября
    for (const layers of [all, new Set<CalendarLayer>(['mine', 'department'])]) {
      const events = eventsByDay(days, department, absences, layers, currentUserId);
      expect(events.get('2026-09-18')?.conflicts.map((t) => t.title)).toContain(
        'Перевод устава на кыргызский язык',
      );
    }
    const load = monthLoad(eventsByDay(days, department, absences, all, currentUserId), '2026-09');
    expect(load.conflicts.some((c) => c.task.assignee?.short === 'Н. Бакиров')).toBe(true);
  });

  it('пик — от трёх сроков в день; по людям — по убыванию', () => {
    const extra = department.slice(0, 3).map((t) => ({ ...t, id: `${t.id}-x`, due: '2026-09-24' }));
    const events = eventsByDay(days, [...department, ...extra], [], all, currentUserId);
    expect(loadLevel(events.get('2026-09-24'))).toBe(3);
    const load = monthLoad(events, '2026-09');
    expect(load.peaks).toContain('2026-09-24');
    const counts = load.byPerson.map((p) => p.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});
