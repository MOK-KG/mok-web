import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentPersonId } from '@/features/auth';
import { useKnowledge } from '@/features/knowledge-base/api';
import { useTasks } from '@/features/tasks/api';
import type { Task } from '@/features/tasks/types';
import { BookIcon, ChatIcon, GroupIcon, SearchIcon, TasksIcon, XIcon } from '@/shared/ui/icons';
import { useChatMembers, useChats, useStartDirect } from './api';
import { NewGroupForm } from './groups';
import { MemberAvatar, useMemberLine } from './parts';
import type { Chat, ChatMember } from './types';

export function PickerDialog({
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

export function SearchBox({
  value,
  onChange,
  label,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  /** false — когда в окне есть поле важнее поиска */
  autoFocus?: boolean;
}) {
  return (
    <label className="relative mt-4 flex h-9 shrink-0 items-center">
      <SearchIcon size={16} className="pointer-events-none absolute left-[10px] text-dim" />
      <input
        type="search"
        // biome-ignore lint/a11y/noAutofocus: окно открыто ради поиска
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        className="h-full w-full rounded-9 border border-line bg-column pl-[34px] pr-[10px] text-[12.5px] text-text outline-none placeholder:text-dim focus:border-info"
      />
    </label>
  );
}

/** Новая переписка: выбрать сотрудника или создать группу */
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
  const [group, setGroup] = useState(false);
  const close = () => {
    setGroup(false);
    onClose();
  };
  const opened = (id: string) => {
    setGroup(false);
    onOpened(id);
  };
  return (
    <PickerDialog
      open={open}
      title={group ? t('chat.newGroup') : t('chat.newChat')}
      hint={group ? t('chat.newGroupHint') : t('chat.pickPersonHint')}
      onClose={close}
    >
      {group ? (
        <NewGroupForm onCreated={opened} onCancel={() => setGroup(false)} />
      ) : (
        <PeopleList onOpened={opened} onGroup={() => setGroup(true)} />
      )}
    </PickerDialog>
  );
}

function PeopleList({
  onOpened,
  onGroup,
}: {
  onOpened: (chatId: string) => void;
  onGroup: () => void;
}) {
  const { t } = useTranslation();
  const start = useStartDirect();
  const chatMembers = useChatMembers();
  const me = useCurrentPersonId();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const people = Object.values(chatMembers).filter(
    (m) =>
      m.id !== me &&
      m.active !== false &&
      (!needle ||
        [m.name, m.department, m.role, t(`access.roles.${m.role}`)].some((v) =>
          v.toLowerCase().includes(needle),
        )),
  );
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('chat.search')} />
      <button
        type="button"
        onClick={onGroup}
        className="mt-3 flex w-full shrink-0 items-center gap-[10px] rounded-9 px-2 py-[7px] text-left text-[13px] font-medium text-info hover:bg-row-highlight"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-8 bg-chip text-info">
          <GroupIcon size={16} />
        </span>
        {t('chat.newGroup')}
      </button>
      <ul className="mt-1 min-h-0 flex-1 overflow-y-auto">
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

/** Куда отправить задачу на обсуждение: каналы, группы и личные переписки сотрудника */
export function ChatPickerDialog({
  open,
  onClose,
  onPick,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (chat: Chat) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <PickerDialog
      open={open}
      title={t('chat.discussTitle')}
      hint={t('chat.discussHint')}
      onClose={onClose}
    >
      <ChatList onPick={onPick} busy={busy} />
    </PickerDialog>
  );
}

function ChatList({ onPick, busy }: { onPick: (chat: Chat) => void; busy: boolean }) {
  const { t } = useTranslation();
  const chats = useChats().data ?? [];
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const order = { channel: 0, group: 1, direct: 2 } as const;
  const shown = chats
    .filter((c) => !needle || [c.title, c.fullTitle].some((v) => v.toLowerCase().includes(needle)))
    .sort((a, b) => order[a.kind] - order[b.kind]);
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('chat.pickChatSearch')} />
      <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {shown.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-[10px] rounded-9 px-2 py-[8px] text-left hover:bg-row-highlight disabled:opacity-50"
            >
              {c.kind === 'direct' ? (
                <ChatIcon size={16} className="shrink-0 text-faint" />
              ) : (
                <GroupIcon size={16} className="shrink-0 text-info" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-text">{c.title}</span>
                <span className="block truncate text-[10.5px] text-dim">
                  {t(`chat.kind.${c.kind}`)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="py-6 text-center text-[12px] text-dim">{t('chat.noChats')}</li>
        )}
      </ul>
    </>
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

export function ArticlePickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (article: { id: string; title: string }) => void;
}) {
  const { t } = useTranslation();
  return (
    <PickerDialog open={open} title={t('chat.attachArticle')} onClose={onClose}>
      <ArticleList onPick={onPick} />
    </PickerDialog>
  );
}

function ArticleList({ onPick }: { onPick: (article: { id: string; title: string }) => void }) {
  const { t } = useTranslation();
  const articles = useKnowledge().data?.articles ?? [];
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = articles.filter((a) => !needle || a.title.toLowerCase().includes(needle));
  return (
    <>
      <SearchBox value={query} onChange={setQuery} label={t('chat.pickArticleSearch')} />
      <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {shown.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onPick({ id: a.id, title: a.title })}
              className="flex w-full items-center gap-[10px] rounded-9 px-2 py-[8px] text-left hover:bg-row-highlight"
            >
              <BookIcon size={16} className="shrink-0 text-tone-violet" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-text">{a.title}</span>
                {a.summary && (
                  <span className="block truncate text-[10.5px] text-dim">{a.summary}</span>
                )}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="py-6 text-center text-[12px] text-dim">{t('chat.noArticles')}</li>
        )}
      </ul>
    </>
  );
}
