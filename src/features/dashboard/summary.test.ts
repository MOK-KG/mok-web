import { describe, expect, it } from 'vitest';
import { mockAbsences } from '../tasks/absences';
import { urgencyOf } from '../tasks/deadline';
import { currentUserId } from '../tasks/directory';
import { createMockTasks } from '../tasks/mock';
import { dashboardSummary, nextHoliday, partOfDay, todayKind, workMonth } from './summary';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

describe('сводка рабочего стола', () => {
  const { department } = createMockTasks(TODAY);
  const summary = dashboardSummary(department, mockAbsences(TODAY), currentUserId, TODAY);

  it('мои задачи — только незакрытые задачи текущего пользователя, сначала просроченные', () => {
    expect(summary.mine.length).toBeGreaterThan(0);
    expect(summary.mine.every((t) => t.assignee?.id === currentUserId)).toBe(true);
    expect(summary.mine.every((t) => t.status !== 'done')).toBe(true);
    expect(summary.mine[0].title).toBe('Ответить на запрос МОК по антидопинговой программе');
  });

  it('счётчики — подмножества моих задач и совпадают со сроками на карточках', () => {
    expect(summary.overdue.map((t) => t.title)).toEqual([
      'Ответить на запрос МОК по антидопинговой программе',
    ]);
    for (const t of summary.soon) {
      expect(summary.mine).toContain(t);
      expect(urgencyOf(t, TODAY).urgency).toBe('soon');
    }
  });

  it('эскалации — незакрытые задачи всего департамента', () => {
    expect(summary.escalations.map((t) => t.title)).toEqual(['Перевод устава на кыргызский язык']);
  });

  it('отпуска: сейчас — Н. Бакиров и М. Эсенова, скоро — Д. Токтосунова', () => {
    expect(summary.absentNow.map((a) => a.person.short)).toEqual(['Н. Бакиров', 'М. Эсенова']);
    expect(summary.absentSoon.map((a) => a.person.short)).toEqual(['Д. Токтосунова']);
  });
});

describe('календарь на рабочем столе', () => {
  it('рабочие дни месяца по календарю КР: в сентябре 2026 — 22, с 9-го осталось 16', () => {
    expect(workMonth(TODAY)).toEqual({ total: 22, left: 16 });
  });

  it('в мае 2026 праздники не считаются рабочими днями', () => {
    // Май 2026: 21 будний день, из них праздники 1, 4–8 и 27 мая
    expect(workMonth('2026-05-01').total).toBe(14);
  });

  it('ближайший праздник после 9 сентября — Новый год, первый день каникул', () => {
    expect(nextHoliday(TODAY)).toEqual({
      date: '2027-01-01',
      holiday: 'newYearHolidays',
      days: 114,
    });
  });

  it('тип дня', () => {
    expect(todayKind(TODAY)).toBe('working');
    expect(todayKind('2026-09-12')).toBe('weekend');
    expect(todayKind('2026-03-21')).toBe('holiday');
    expect(todayKind('2026-12-31')).toBe('shortened');
  });

  it('время суток считается по Бишкеку (UTC+6)', () => {
    expect(partOfDay(new Date('2026-09-09T02:00:00Z'))).toBe('morning');
    expect(partOfDay(new Date('2026-09-09T08:00:00Z'))).toBe('day');
    expect(partOfDay(new Date('2026-09-09T14:00:00Z'))).toBe('evening');
  });
});
