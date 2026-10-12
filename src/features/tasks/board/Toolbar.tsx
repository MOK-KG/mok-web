import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Can } from '@/features/auth';
import {
  CheckboxCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CloseSmallIcon,
  FilterIcon,
  GroupIcon,
  PlusIcon,
  SearchIcon,
} from '@/shared/ui/icons';
import { type DueFilter, dueFilters, hasFilters, matchesDue, type TaskFilters } from '../filters';
import type { Project, Task, TaskTab } from '../types';
import { taskTabs } from '../types';
import { toneClasses } from '../ui';
import type { Grouping } from './Board';

const field =
  'flex h-8 items-center gap-2 rounded-9 border border-line bg-panel px-[10px] text-[12.5px] font-medium tracking-[-0.1px] text-sub';

type Props = {
  tab: TaskTab;
  onTab: (tab: TaskTab) => void;
  counts?: Record<TaskTab, number>;
  grouping: Grouping;
  onGrouping: (g: Grouping) => void;
  search: string;
  onSearch: (s: string) => void;
  filters: TaskFilters;
  onFilters: (f: TaskFilters) => void;
  /** Задачи вкладки до фильтров — для счётчиков в фильтре */
  tasks: Task[];
  onNewTask: () => void;
};

/** Строка вкладок со счётчиками и панель инструментов доски */
export function Toolbar(props: Props) {
  const { t } = useTranslation();
  const { tab, onTab, counts } = props;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label={t('tasks.board')} className="flex items-center gap-6 pl-1">
        {taskTabs.map((key) => {
          const selected = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTab(key)}
              className={`relative flex h-10 items-center gap-[7px] text-[13px] tracking-[-0.1px] ${
                selected ? 'font-semibold text-text' : 'text-sub hover:text-text'
              }`}
            >
              {t(`tasks.tabs.${key}`)}
              {counts && (
                <span
                  className={`text-[11px] font-medium tracking-[0.2px] ${selected ? 'text-tone-gold' : 'text-dim'}`}
                >
                  {counts[key]}
                </span>
              )}
              {selected && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-[4px] h-[2px] rounded-full bg-brand-red"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <GroupingMenu value={props.grouping} onChange={props.onGrouping} />
        <label className={`${field} w-40 font-normal`}>
          <SearchIcon size={16} className="shrink-0 text-faint" />
          <span className="sr-only">{t('tasks.search')}</span>
          <input
            type="search"
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
            placeholder={t('tasks.search')}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-text outline-none placeholder:text-dim"
          />
        </label>
        <FilterPopover tasks={props.tasks} value={props.filters} onChange={props.onFilters} />
        <Can permission="tasks.create">
          <button
            type="button"
            onClick={props.onNewTask}
            className="flex h-8 items-center gap-[7px] rounded-9 bg-brand-red px-3 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90"
          >
            <PlusIcon size={16} />
            {t('tasks.newTask')}
          </button>
        </Can>
      </div>
    </div>
  );
}

function GroupingMenu({ value, onChange }: { value: Grouping; onChange: (g: Grouping) => void }) {
  const { t } = useTranslation();
  const options: Grouping[] = ['none', 'project', 'assignee'];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={`${field} w-[186px] hover:text-text`}>
        <GroupIcon size={16} className="shrink-0" />
        <span className="flex-1 text-left">{t(`tasks.group.${value}`)}</span>
        <ChevronDownIcon size={13} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[186px] rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={(v) => onChange(v as Grouping)}>
            {options.map((o) => (
              <DropdownMenu.RadioItem
                key={o}
                value={o}
                className="flex h-[34px] cursor-pointer items-center rounded-[7px] px-3 text-[12px] text-sub outline-none data-[highlighted]:bg-popover-active data-[state=checked]:bg-popover-active data-[highlighted]:text-text data-[state=checked]:font-medium data-[state=checked]:text-text"
              >
                <span className="flex-1">{t(`tasks.group.${o}`)}</span>
                <DropdownMenu.ItemIndicator className="text-brand-gold">
                  <CheckIcon size={14} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const projectsOf = (tasks: Task[]) => {
  const map = new Map<string, Project>();
  for (const t of tasks) if (t.project) map.set(t.project.id, t.project);
  return [...map.values()];
};

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] ${
        checked ? 'bg-info text-panel' : 'border-[1.4px] border-dim'
      }`}
    >
      {checked && <CheckboxCheckIcon size={11} />}
    </span>
  );
}

const dueLabel: Record<DueFilter, string> = {
  overdue: 'tasks.dueOverdue',
  week: 'tasks.dueWeek',
  none: 'tasks.dueNone',
};

/** Поповер фильтра: выбор применяется кнопкой «Применить» (макет Figma) */
function FilterPopover({
  tasks,
  value,
  onChange,
}: {
  tasks: Task[];
  value: TaskFilters;
  onChange: (f: TaskFilters) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TaskFilters>(value);
  const active = hasFilters(value);

  const toggle = <K extends keyof TaskFilters>(key: K, item: TaskFilters[K][number]) =>
    setDraft((d) => {
      const list = d[key] as string[];
      return {
        ...d,
        [key]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item],
      };
    });

  const row =
    'flex h-8 w-full cursor-pointer items-center gap-[10px] rounded-[7px] px-[10px] text-[12px] tracking-[-0.1px]';

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value);
      }}
    >
      <Popover.Trigger
        className={`${field} w-[92px] ${active || open ? 'border-info bg-popover-active text-text' : 'hover:text-text'}`}
      >
        <FilterIcon size={16} className="shrink-0" />
        {t('tasks.filter')}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[300px] rounded-12 border border-line bg-popover shadow-[0_10px_32px_rgba(0,0,0,0.45)]"
        >
          <fieldset className="p-[5px]">
            <legend className="px-[10px] pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-dim">
              {t('tasks.filterProject')}
            </legend>
            {projectsOf(tasks).map((p) => {
              const checked = draft.projects.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`${row} ${checked ? 'bg-popover-active font-medium text-text' : 'text-sub hover:bg-row-highlight'}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggle('projects', p.id)}
                  />
                  <Checkbox checked={checked} />
                  <span
                    aria-hidden
                    className={`size-[6px] rounded-full ${toneClasses[p.tone].dot}`}
                  />
                  <span className="flex-1">{p.name}</span>
                  <span className="text-[10.5px] font-normal text-dim">
                    {tasks.filter((x) => x.project?.id === p.id).length}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <fieldset className="border-t border-line p-[5px]">
            <legend className="px-[10px] pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[1.4px] text-dim">
              {t('tasks.filterDue')}
            </legend>
            {dueFilters.map((d) => {
              const checked = draft.due.includes(d);
              return (
                <label
                  key={d}
                  className={`${row} ${checked ? 'bg-popover-active font-medium text-text' : 'text-sub hover:bg-row-highlight'}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggle('due', d)}
                  />
                  <Checkbox checked={checked} />
                  <span className="flex-1">{t(dueLabel[d])}</span>
                  <span className="text-[10.5px] font-normal text-dim">
                    {tasks.filter((x) => matchesDue(x, d)).length}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div className="flex items-center justify-between border-t border-line px-[15px] py-3">
            <button
              type="button"
              onClick={() => setDraft({ projects: [], due: [] })}
              className="flex items-center gap-[5px] text-[11.5px] font-medium text-sub hover:text-text"
            >
              <CloseIcon size={15} />
              {t('tasks.reset')}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="h-7 rounded-[7px] bg-info px-4 text-[11.5px] font-semibold text-panel hover:opacity-90"
            >
              {t('tasks.apply')}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Строка активных фильтров: «Фильтр: [Антидопинг ×] … 9 из 20 задач» */
export function ActiveFilters({
  filters,
  onChange,
  tasks,
  shown,
}: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  tasks: Task[];
  shown: number;
}) {
  const { t } = useTranslation();
  if (!hasFilters(filters)) return null;
  const projects = projectsOf(tasks).filter((p) => filters.projects.includes(p.id));
  const chip =
    'flex h-6 items-center gap-[6px] rounded-6 border border-line bg-control pl-[9px] pr-[6px] text-[11px] font-medium tracking-[-0.1px] text-text';
  return (
    <div className="flex flex-wrap items-center gap-[7px] pl-1">
      <span className="text-[11.5px] text-faint">{t('tasks.filterLabel')}</span>
      {projects.map((p) => (
        <span key={p.id} className={chip}>
          <span aria-hidden className={`size-[6px] rounded-full ${toneClasses[p.tone].dot}`} />
          {p.name}
          <button
            type="button"
            aria-label={t('tasks.removeFilter', { name: p.name })}
            onClick={() =>
              onChange({ ...filters, projects: filters.projects.filter((x) => x !== p.id) })
            }
            className="text-faint hover:text-text"
          >
            <CloseSmallIcon size={11} />
          </button>
        </span>
      ))}
      {filters.due.map((d) => (
        <span key={d} className={chip}>
          {t(dueLabel[d])}
          <button
            type="button"
            aria-label={t('tasks.removeFilter', { name: t(dueLabel[d]) })}
            onClick={() => onChange({ ...filters, due: filters.due.filter((x) => x !== d) })}
            className="text-faint hover:text-text"
          >
            <CloseSmallIcon size={11} />
          </button>
        </span>
      ))}
      <span className="ml-1 text-[11.5px] text-dim">
        {t('tasks.filteredOf', { shown, total: tasks.length })}
      </span>
    </div>
  );
}
