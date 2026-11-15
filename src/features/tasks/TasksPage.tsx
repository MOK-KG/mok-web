import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Can, useCan } from '@/features/auth';
import { storage } from '@/shared/lib/storage';
import { NARROW, useMediaQuery } from '@/shared/lib/useMediaQuery';
import { useBoard } from './api';
import { Board, type Grouping } from './board/Board';
import { QueueBanner } from './board/QueueBanner';
import { ActiveFilters, type TaskView, Toolbar } from './board/Toolbar';
import { applyFilters, emptyFilters, hasFilters, type TaskFilters } from './filters';
import { TaskList } from './list/TaskList';
import type { Letter } from './mailQueue';
import { NewTaskModal } from './modal/NewTaskModal';
import { QueueModal } from './modal/QueueModal';
import { TaskModal } from './modal/TaskModal';
import type { TaskTab } from './types';

const VIEW_KEY = 'nok.tasksView';

/** Раздел «Задачи»: вкладки, панель инструментов, очередь из почты, канбан-доска */
export function TasksPage() {
  const [tab, setTab] = useState<TaskTab>('department');
  const [grouping, setGrouping] = useState<Grouping>('none');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TaskFilters>(emptyFilters);
  const narrow = useMediaQuery(NARROW);
  const [chosenView, setChosenView] = useState<TaskView | null>(() => {
    const saved = storage.get(VIEW_KEY);
    return saved === 'board' || saved === 'list' ? saved : null;
  });
  const view: TaskView = chosenView ?? (narrow ? 'list' : 'board');
  const changeView = (next: TaskView) => {
    storage.set(VIEW_KEY, next);
    setChosenView(next);
  };
  const { can } = useCan();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  // Очередь из почты открывается и по ссылке ?queue=1 — из уведомления «Разобрать»
  const queueOpen = params.get('queue') === '1';
  const setQueueOpen = (open: boolean) =>
    setParams((p) => {
      if (open) p.set('queue', '1');
      else p.delete('queue');
      return p;
    });
  // Письмо, которое оформляют задачей вручную
  const [manualLetter, setManualLetter] = useState<Letter | null>(null);
  // Открытая задача — в адресе (?task=ID): ссылкой можно поделиться
  const openTaskId = params.get('task');
  const openTask = (id: string) => setParams((p) => ({ ...Object.fromEntries(p), task: id }));
  const closeTask = () =>
    setParams((p) => {
      p.delete('task');
      return p;
    });
  const board = useBoard(tab);
  const counts = useBoard('department').data?.counts;

  const all = board.data?.tasks ?? [];
  const visible = useMemo(() => applyFilters(all, filters, search), [all, filters, search]);

  return (
    <div className="flex flex-col gap-[10px]">
      <Toolbar
        tab={tab}
        onTab={setTab}
        counts={counts}
        grouping={grouping}
        onGrouping={setGrouping}
        search={search}
        onSearch={setSearch}
        filters={filters}
        onFilters={setFilters}
        tasks={all}
        onNewTask={() => setCreating(true)}
        view={view}
        onView={changeView}
      />
      <ActiveFilters filters={filters} onChange={setFilters} tasks={all} shown={visible.length} />
      <Can permission="tasks.create">
        <QueueBanner onOpen={() => setQueueOpen(true)} />
      </Can>
      {view === 'list' ? (
        <TaskList tasks={visible} columns={board.data?.columns ?? []} onOpen={openTask} />
      ) : (
        <div className="overflow-x-auto pb-2">
          <Board
            columns={board.data?.columns ?? []}
            tasks={visible}
            grouping={grouping}
            canDrag={can('tasks.edit') && tab !== 'completed'}
            filtered={hasFilters(filters) || search.trim() !== ''}
            onOpen={openTask}
          />
        </div>
      )}
      <TaskModal taskId={openTaskId} onClose={closeTask} />
      <NewTaskModal
        open={creating}
        letter={manualLetter}
        onClose={() => {
          setCreating(false);
          setManualLetter(null);
        }}
        onOpenTask={openTask}
      />
      <QueueModal
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        // Одним обновлением адреса: закрыть очередь и открыть задачу
        onOpenTask={(id) =>
          setParams((p) => {
            p.delete('queue');
            p.set('task', id);
            return p;
          })
        }
        onManual={(letter) => {
          setQueueOpen(false);
          setManualLetter(letter);
          setCreating(true);
        }}
      />
    </div>
  );
}
