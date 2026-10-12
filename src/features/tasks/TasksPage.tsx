import { useMemo, useState } from 'react';
import { Can, useCan } from '@/features/auth';
import { useTabCounts, useTasks } from './api';
import { Board, type Grouping } from './board/Board';
import { QueueBanner } from './board/QueueBanner';
import { ActiveFilters, Toolbar } from './board/Toolbar';
import { applyFilters, emptyFilters, hasFilters, type TaskFilters } from './filters';
import type { TaskTab } from './types';

/** Раздел «Задачи»: вкладки, панель инструментов, очередь из почты, канбан-доска */
export function TasksPage() {
  const [tab, setTab] = useState<TaskTab>('department');
  const [grouping, setGrouping] = useState<Grouping>('none');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const { can } = useCan();
  const counts = useTabCounts();
  const tasks = useTasks(tab);

  const all = tasks.data ?? [];
  const visible = useMemo(() => applyFilters(all, filters, search), [all, filters, search]);

  return (
    <div className="flex flex-col gap-[10px]">
      <Toolbar
        tab={tab}
        onTab={setTab}
        counts={counts.data}
        grouping={grouping}
        onGrouping={setGrouping}
        search={search}
        onSearch={setSearch}
        filters={filters}
        onFilters={setFilters}
        tasks={all}
      />
      <ActiveFilters filters={filters} onChange={setFilters} tasks={all} shown={visible.length} />
      <Can permission="tasks.create">
        <QueueBanner />
      </Can>
      <div className="overflow-x-auto pb-2">
        <Board
          tasks={visible}
          grouping={grouping}
          canDrag={can('tasks.edit') && tab !== 'completed'}
          inProgressAll={all.filter((t) => t.status === 'in_progress').length}
          filtered={hasFilters(filters) || search.trim() !== ''}
        />
      </div>
    </div>
  );
}
