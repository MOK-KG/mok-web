import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { toast } from '@/shared/lib/toast';
import { projects } from '../directory';
import type { TaskFilters } from '../filters';
import { createMockTasks } from '../mock';
import { ActiveFilters } from './Toolbar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let current: TaskFilters;

const tasks = createMockTasks().department;

function Harness({ initial }: { initial: TaskFilters }) {
  const [filters, setFilters] = useState(initial);
  current = filters;
  return <ActiveFilters filters={filters} onChange={setFilters} tasks={tasks} shown={3} />;
}

const button = (name: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === name);

beforeEach(async () => {
  await i18n.changeLanguage('ru');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <AppProviders>
        <Harness initial={{ projects: [projects.antidoping.id], due: ['overdue'] }} />
      </AppProviders>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  toast.clear();
});

describe('строка активных фильтров', () => {
  it('«Сбросить все» — тост с возможностью вернуть фильтры', async () => {
    await act(async () => button('Сбросить все')?.click());
    expect(current).toEqual({ projects: [], due: [] });
    const status = document.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Фильтры сброшены');

    await act(async () => button('Вернуть')?.click());
    expect(current).toEqual({ projects: [projects.antidoping.id], due: ['overdue'] });
    // Тост закрывается после действия
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it('у кнопок-крестиков есть подпись (и подсказка с тем же текстом)', () => {
    const labels = [...container.querySelectorAll('button[aria-label]')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Убрать фильтр «Антидопинг 2026»', 'Убрать фильтр «Просрочено»']);
  });
});
