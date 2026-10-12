import { describe, expect, it } from 'vitest';
import { matchesQuick, sortForList } from './list';
import { createMockTasks } from './mock';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

describe('мобильный список задач', () => {
  const { department } = createMockTasks(TODAY);
  const count = (q: Parameters<typeof matchesQuick>[1]) =>
    department.filter((t) => matchesQuick(t, q, TODAY)).length;

  it('быстрые фильтры как в макете: Все 20, Просрочено 1, Мои 7, Горит 2', () => {
    expect([count('all'), count('overdue'), count('mine'), count('hot')]).toEqual([20, 1, 7, 2]);
  });

  it('порядок: просрочено, эскалация, «горит», срок на неделе, отпуск; готовые в конце', () => {
    const titles = sortForList(department, TODAY).map((t) => t.title);
    expect(titles.slice(0, 5)).toEqual([
      'Ответить на запрос МОК по антидопинговой программе',
      'Перевод устава на кыргызский язык',
      'Обновить регламент аккредитации журналистов',
      'Смета на Азиатские игры 2026',
      'Антидопинговый план на 2027 год',
    ]);
    const statuses = sortForList(department, TODAY).map((t) => t.status);
    expect(statuses.slice(-8).every((s) => s === 'done')).toBe(true);
  });
});
