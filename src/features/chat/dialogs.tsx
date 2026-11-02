import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTasks } from '@/features/tasks/api';
import type { Task } from '@/features/tasks/types';
import { SearchIcon, TasksIcon, XIcon } from '@/shared/ui/icons';
import { chatMembers, currentMemberId, useStartDirect } from './api';
import { MemberAvatar, useMemberLine } from './parts';
import type { ChatMember } from './types';

function PickerDialog({
  open,
  title,
  hint,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content
          {...(hint ? {} : { 'aria-describedby': undefined })}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(560px,calc(100vh-48px))] w-[min(460px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-18 border border-line bg-panel px-[23px] pb-[18px] pt-[21px] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <Dialog.Title className="pr-10 text-[17px] font-semibold tracking-[-0.3px] text-text">
            {title}
          </Dialog.Title>
          {hint && (
            <Dialog.Description className="mt-1 text-[11.5px] leading-4 text-faint">
              {hint}
            </Dialog.Description>
          )}
          {open && children}
          <Dialog.Close
            aria-label={t('chat.close')}
            className="absolute right-[19px] top-[19px] flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="relative mt-4 flex h-9 shrink-0 items-center">
      <SearchIcon size={16} className="pointer-events-none absolute left-[10px] text-dim" />
      <input
        type="search"
        // biome-ignore lint/a11y/noAutofocus: окно открыто ради поиска
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="h-full w-full rounded-9 border border-line bg-column pl-[34px] pr-[10px] text-[12.5px] text-text outline-none placeholder:text-dim focus:border-info"
      />
    </label>
  );
}

/** Новая личная переписка: выбрать сотрудника */
export function NewChatDialog({
  open,
  onClose,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: (chatId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <PickerDialog
      open={open}
      title={t('chat.newChat')}
      hint={t('chat.pickPersonHint')}
      onClose={onClose}
    >
      <PeopleList onOpened={onOpened} />
    </PickerDialog>
  );
}

function PeopleList({ onOpened }: { onOpened: (chatId: string) => void }) {
  const { t } = useTranslation();
  const start = useStartDirect();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const people = Object.values(chatMembers).filter(
    (m) =>
      m.id !== currentMemberId &&
      (!needle ||
        [m.name, m.department, m.role, t(`access.roles.${m.role}`)].some((v) =>
          v.toLowerCase().includes(needle),
        )),
  );
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('chat.search')} />
      <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {people.map((m) => (
          <PersonRow
            key={m.id}
            member={m}
            onPick={() =>
              start
                .mutateAsync(m.id)
                .then(onOpened)
                .catch(() => null)
            }
          />
        ))}
        {people.length === 0 && (
          <li className="py-6 text-center text-[12px] text-dim">{t('chat.nothingFound')}</li>
        )}
      </ul>
    </>
  );
}

function PersonRow({ member, onPick }: { member: ChatMember; onPick: () => void }) {
  const line = useMemberLine(member.id);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center gap-[10px] rounded-9 px-2 py-[7px] text-left hover:bg-row-highlight"
      >
        <MemberAvatar member={member} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text">{member.name}</span>
          <span className="block truncate text-[10.5px] text-dim">{line}</span>
        </span>
      </button>
    </li>
  );
}

/** Прикрепить задачу из доски: незакрытые задачи департамента */
export function TaskPickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (task: Task) => void;
}) {
  const { t } = useTranslation();
  return (
    <PickerDialog open={open} title={t('chat.attachTask')} onClose={onClose}>
      <TaskList onPick={onPick} />
    </PickerDialog>
  );
}

function TaskList({ onPick }: { onPick: (task: Task) => void }) {
  const { t } = useTranslation();
  const tasks = useTasks('department').data ?? [];
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = tasks.filter(
    (x) =>
      x.status !== 'done' &&
      (!needle || x.title.toLowerCase().includes(needle) || x.code.toLowerCase().includes(needle)),
  );
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('chat.pickTaskSearch')} />
      <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {shown.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              onClick={() => onPick(x)}
              className="flex w-full items-center gap-[10px] rounded-9 px-2 py-[8px] text-left hover:bg-row-highlight"
            >
              <TasksIcon size={16} className="shrink-0 text-info" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-text">{x.title}</span>
                <span className="block truncate text-[10.5px] text-dim">
                  {x.code} · {t(`tasks.status.${x.status}`)}
                  {x.assignee && ` · ${x.assignee.short}`}
                </span>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="py-6 text-center text-[12px] text-dim">{t('chat.noTasks')}</li>
        )}
      </ul>
    </>
  );
}
