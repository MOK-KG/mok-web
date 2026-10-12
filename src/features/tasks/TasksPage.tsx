import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Can, useCan } from '@/features/auth';
import { useTabCounts, useTasks } from './api';
import { Board, type Grouping } from './board/Board';
import { QueueBanner } from './board/QueueBanner';
import { ActiveFilters, Toolbar } from './board/Toolbar';
import { applyFilters, emptyFilters, hasFilters, type TaskFilters } from './filters';
import { NewTaskModal } from './modal/NewTaskModal';
import { TaskModal } from './modal/TaskModal';
import type { TaskTab } from './types';

/** Раздел «Задачи»: вкладки, панель инструментов, очередь из почты, канбан-доска */
export function TasksPage() {
  const [tab, setTab] = useState<TaskTab>('department');
  const [grouping, setGrouping] = useState<Grouping>('none');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const { can } = useCan();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  // Открытая задача — в адресе (?task=ID): ссылкой можно поделиться
  const openTaskId = params.get('task');
  const openTask = (id: string) => setParams((p) => ({ ...Object.fromEntries(p), task: id }));
  const closeTask = () =>
    setParams((p) => {
      p.delete('task');
      return p;
    });
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
        onNewTask={() => setCreating(true)}
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
          onOpen={openTask}
        />
      </div>
      <TaskModal taskId={openTaskId} onClose={closeTask} />
      <NewTaskModal open={creating} onClose={() => setCreating(false)} onOpenTask={openTask} />
    </div>
  );
}
