import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { api } from '@/shared/api/client';
import { addDays } from '@/shared/lib/workDays';
import {
  applyMove,
  type Board,
  createTask,
  moveTask,
  resetTasksMock,
  updateTask,
  WipLimitError,
} from './api';
import { urgencyOf } from './deadline';
import { people } from './directory';
import { applyFilters, departmentOf, departmentsOf, emptyFilters, matchesDue } from './filters';
import { createMockTasks, mockColumnId } from './mock';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

describe('срочность и фильтры (логика)', () => {
  const { department } = createMockTasks(TODAY);

  it('срочность по сроку: просрочено, ≤2 дня, ≤7 дней, позже, без срока', () => {
    const base = { status: 'queue' as const };
    expect(urgencyOf({ ...base, due: addDays(TODAY, -1) }, TODAY)).toEqual({
      urgency: 'overdue',
      days: 1,
    });
    expect(urgencyOf({ ...base, due: addDays(TODAY, 2) }, TODAY)).toEqual({
      urgency: 'soon',
      days: 2,
    });
    expect(urgencyOf({ ...base, due: addDays(TODAY, 6) }, TODAY)).toEqual({
      urgency: 'week',
      days: 6,
    });
    expect(urgencyOf({ ...base, due: addDays(TODAY, 9) }, TODAY).urgency).toBe('later');
    expect(urgencyOf({ ...base, due: null }, TODAY).urgency).toBe('none');
    // Готовая задача со сроком в прошлом — не «просрочена»
    expect(urgencyOf({ status: 'done', due: addDays(TODAY, -5) }, TODAY).urgency).toBe('later');
  });

  it('фильтр по сроку: просрочено 1, на этой неделе 1 (до воскресенья), без срока 2', () => {
    expect(department.filter((t) => matchesDue(t, 'overdue', TODAY))).toHaveLength(1);
    expect(department.filter((t) => matchesDue(t, 'week', TODAY))).toHaveLength(1);
    expect(department.filter((t) => matchesDue(t, 'none', TODAY))).toHaveLength(2);
  });

  it('проекты — «или», поиск — по названию без учёта регистра', () => {
    const two = applyFilters(
      department,
      { ...emptyFilters, projects: ['p-antidoping', 'p-accreditation'] },
      '',
      TODAY,
    );
    expect(two).toHaveLength(6);
    expect(applyFilters(department, emptyFilters, 'УСТАВ', TODAY).map((t) => t.title)).toEqual([
      'Перевод устава на кыргызский язык',
    ]);
  });

  it('департамент — по исполнителю; счётчики департаментов равны числу задач с исполнителем', () => {
    const list = departmentsOf(department);
    expect(list.map((d) => d.name)).toEqual(
      [...list.map((d) => d.name)].sort((a, b) => a.localeCompare(b, 'ru')),
    );
    expect(list.reduce((sum, d) => sum + d.count, 0)).toBe(
      department.filter((t) => departmentOf(t) !== null).length,
    );
  });

  it('департаменты — «или», вместе с проектом — «и»', () => {
    const [first, second] = departmentsOf(department);
    const one = applyFilters(department, { ...emptyFilters, departments: [first.name] }, '', TODAY);
    expect(one).toHaveLength(first.count);
    expect(one.every((t) => t.assignee?.unit === first.name)).toBe(true);
    const both = applyFilters(
      department,
      { ...emptyFilters, departments: [first.name, second.name] },
      '',
      TODAY,
    );
    expect(both).toHaveLength(first.count + second.count);
    const project = department.find((t) => t.project && departmentOf(t) === first.name)?.project;
    const narrowed = applyFilters(
      department,
      { ...emptyFilters, departments: [first.name], projects: [project?.id ?? ''] },
      '',
      TODAY,
    );
    expect(
      narrowed.every((t) => t.project?.id === project?.id && departmentOf(t) === first.name),
    ).toBe(true);
    expect(narrowed.length).toBeGreaterThan(0);
  });

  it('сумма задач по проектам равна числу задач', () => {
    const byProject = new Map<string, number>();
    for (const t of department) {
      const id = t.project?.id ?? 'none';
      byProject.set(id, (byProject.get(id) ?? 0) + 1);
    }
    expect([...byProject.values()].reduce((a, b) => a + b, 0)).toBe(department.length);
  });
});

describe('лимит «В работе»', () => {
  it('в «В работе» не больше 6 задач', async () => {
    resetTasksMock();
    const { department } = createMockTasks();
    const queue = department.filter((t) => t.status === 'queue').map((t) => t.id);
    // В работе 4 задачи: ещё две можно, седьмую — нет
    const inProgress = mockColumnId('in_progress');
    await moveTask(queue[0], inProgress);
    await moveTask(queue[1], inProgress);
    await expect(moveTask(queue[2], inProgress)).rejects.toBeInstanceOf(WipLimitError);
  });
});

describe('порядок в колонке и правка', () => {
  it('брошенная на карточку задача встаёт перед ней; в конец — без карточки', async () => {
    resetTasksMock();
    const queue = mockColumnId('queue');
    const order = (b: Pick<Board, 'tasks'>) =>
      b.tasks
        .filter((t) => t.columnId === queue)
        .sort((x, y) => x.position - y.position)
        .map((t) => t.id);
    const board = await api.get<Board>('/tasks/board');
    const [first, second, third] = order(board);
    // Оптимистичный порядок на клиенте
    const local = applyMove(board, { id: third, columnId: queue, beforeId: first });
    expect(order(local).slice(0, 3)).toEqual([third, first, second]);
    // Тот же порядок отдаёт сервер
    await moveTask(third, queue, first);
    expect(order(await api.get<Board>('/tasks/board')).slice(0, 3)).toEqual([third, first, second]);
    // Без карточки — в конец колонки
    await moveTask(first, queue);
    expect(order(await api.get<Board>('/tasks/board')).at(-1)).toBe(first);
  });

  it('правка: название и срок меняются, перенос срока — в журнал', async () => {
    resetTasksMock();
    const [task] = createMockTasks().department.filter((t) => t.due && t.status === 'queue');
    const due = addDays(task.due as string, 7);
    const updated = await updateTask(task.id, {
      title: 'Новое название задачи',
      description: 'Описание',
      assignee: null,
      due,
      project: null,
      priority: 'high',
    });
    expect(updated.title).toBe('Новое название задачи');
    expect(updated.priority).toBe('high');
    expect(updated.history[0]).toMatchObject({ kind: 'due' });
    expect(updated.rescheduleLog.at(-1)?.to).toBe(due);
  });
});

describe('создание и похожие задачи', () => {
  it('новая задача попадает в очередь департамента: 20 → 21, «Поставленные мной» 9 → 10', async () => {
    resetTasksMock();
    const task = await createTask({
      title: 'Подготовить отчёт по антидопингу за 2026 год',
      description: '',
      assignee: people.dt,
      due: addDays(TODAY, 3),
      project: null,
      priority: 'normal',
    });
    expect(task.status).toBe('queue');
    expect(task.history[0].kind).toBe('created');
    const { counts } = await api.get<Board>('/tasks/board');
    expect(counts.department).toBe(21);
    // Автор — текущий пользователь: «Поставленные мной» 9 → 10
    expect(counts.createdByMe).toBe(10);
    // Похожие ищутся по словам названия
    const similar = await api.get<{ title: string }[]>('/tasks/similar', {
      query: { title: 'Антидопинговый план на 2028 год' },
    });
    expect(similar.map((t) => t.title)).toContain('Антидопинговый план на 2027 год');
  });
});

let root: Root;
let container: HTMLDivElement;
const text = () => container.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${text().slice(0, 400)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};
const column = (name: string) =>
  container.querySelector<HTMLElement>(`section[aria-label="${name}"]`);
const cardsIn = (name: string) => column(name)?.querySelectorAll('article').length ?? 0;

describe('доска задач', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_AUTH_MOCK', 'active');
    sessionStorage.clear();
    sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R3')));
    resetTasksMock();
    await i18n.changeLanguage('ru');
    const router = createMemoryRouter(routes, { initialEntries: ['/tasks'] });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>,
      ),
    );
    await waitFor(() => cardsIn('Готово') > 0);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('счётчики вкладок совпадают с содержимым: 7 / 20 / 9 / 142', () => {
    const tabs = [...container.querySelectorAll('[role="tab"]')].map((el) => el.textContent);
    expect(tabs).toEqual(['Мои7', 'Департамента20', 'Поставленные мной9', 'Завершённые142']);
  });

  it('колонки: «4 из 6», «4 / 6», «2», «3 из 8» и видно ровно столько карточек', () => {
    expect(column('Очередь')?.querySelector('header')?.textContent).toContain('4 из 6');
    expect(cardsIn('Очередь')).toBe(4);
    expect(column('В работе')?.querySelector('header')?.textContent).toContain('4 / 6');
    expect(cardsIn('В работе')).toBe(4);
    expect(column('На проверке')?.querySelector('header')?.textContent).toContain('2');
    expect(cardsIn('На проверке')).toBe(2);
    expect(column('Готово')?.querySelector('header')?.textContent).toContain('3 из 8');
    expect(cardsIn('Готово')).toBe(3);
  });

  it('«Показать все 8» раскрывает колонку, счётчик становится «8»', async () => {
    const more = [...(column('Готово')?.querySelectorAll('button') ?? [])].find((b) =>
      b.textContent?.includes('Показать все 8'),
    );
    act(() => more?.click());
    expect(cardsIn('Готово')).toBe(8);
    expect(column('Готово')?.querySelector('header')?.textContent).toContain('8');
  });

  it('карточка просроченной задачи: «Просрочено 1 дн»', () => {
    const card = column('Очередь')?.querySelector('article[aria-label^="Ответить на запрос МОК"]');
    expect(card?.textContent).toContain('Просрочено 1 дн');
  });

  it('поиск сужает доску', async () => {
    // Поле доски — в main; в шапке есть ещё поиск по системе
    const input = container.querySelector<HTMLInputElement>('main input[type="search"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      setter?.call(input, 'устав');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelectorAll('article')).toHaveLength(1);
  });

  it('вкладка «Мои» показывает 7 задач', async () => {
    const mine = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')][0];
    await act(async () => mine.click());
    await waitFor(() => mine.getAttribute('aria-selected') === 'true');
    await waitFor(() => {
      const shown = ['Очередь', 'В работе', 'На проверке', 'Готово']
        .map((c) => column(c)?.querySelector('header span:nth-of-type(2)')?.textContent ?? '0')
        .map((s) => Number(s.split(/\s|\//).filter(Boolean).pop()));
      return (
        shown[0] +
          shown[2] +
          shown[3] +
          Number(
            column('В работе')
              ?.querySelector('header span:nth-of-type(2)')
              ?.textContent?.split('/')[0],
          ) ===
        7
      );
    });
  });
});
