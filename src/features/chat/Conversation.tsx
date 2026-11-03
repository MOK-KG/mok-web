import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTasks } from '@/features/tasks/api';
import { formatIsoDate } from '@/shared/lib/date';
import { toast } from '@/shared/lib/toast';
import {
  ArrowRightIcon,
  AttachLargeIcon,
  BoltIcon,
  GroupIcon,
  MoreIcon,
  PaperclipIcon,
  SendIcon,
  TasksIcon,
  XIcon,
} from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import {
  chatMembers,
  currentMemberId,
  threadsOf,
  useMarkChatRead,
  useMessages,
  useSendMessage,
  useSetMuted,
} from './api';
import { TaskPickerDialog } from './dialogs';
import {
  ChannelIcon,
  dayOf,
  MemberAvatar,
  MessageText,
  RoleChip,
  shortDay,
  timeOf,
  useDayLabel,
  useMemberLine,
} from './parts';
import type { ChatMessage, ChatSummary } from './types';

/** Открытая переписка: шапка, сообщения по дням, поле ввода */
export function Conversation({ chat }: { chat: ChatSummary }) {
  const { t } = useTranslation();
  const all = useMessages(chat.id).data ?? [];
  // Ответы в ветках — не в общей ленте, а под сообщением: «2 ответа»
  const messages = all.filter((m) => !m.threadId);
  const threads = threadsOf(all);
  const [thread, setThread] = useState<string | null>(null);
  const threadRoot = thread ? all.find((m) => m.id === thread) : undefined;
  const markRead = useMarkChatRead();
  const dayLabel = useDayLabel();
  const end = useRef<HTMLDivElement>(null);

  // Открыли переписку — всё в ней прочитано; пришло новое — тоже
  useEffect(() => {
    if (chat.unread > 0) markRead.mutate(chat.id);
  }, [chat.id, chat.unread, markRead.mutate]);

  // Новые сообщения — внизу, к ним и прокручиваем
  // biome-ignore lint/correctness/useExhaustiveDependencies: прокрутка при каждом новом сообщении
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  return (
    <>
      <Header chat={chat} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
        {messages.length === 0 && (
          <p className="mt-16 text-center text-[12.5px] text-dim">{t('chat.noMessages')}</p>
        )}
        {messages.map((m, i) => {
          const day = dayOf(m.at);
          const newDay = i === 0 || dayOf(messages[i - 1].at) !== day;
          return (
            <Fragment key={m.id}>
              {newDay && (
                <div className="my-[14px] flex items-center gap-3 text-[10.5px] text-dim">
                  <span className="h-px flex-1 bg-line" />
                  {dayLabel(day)}
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <Message
                message={m}
                peerName={chat.peerId ? chatMembers[chat.peerId]?.name : ''}
                replies={threads.get(m.id)}
                onThread={chat.kind === 'channel' ? () => setThread(m.id) : undefined}
              />
            </Fragment>
          );
        })}
        <div ref={end} />
      </div>
      <Composer chat={chat} />
      {threadRoot && (
        <ThreadPanel
          chat={chat}
          root={threadRoot}
          replies={threads.get(threadRoot.id) ?? []}
          onClose={() => setThread(null)}
        />
      )}
    </>
  );
}

function Header({ chat }: { chat: ChatSummary }) {
  const { t } = useTranslation();
  const setMuted = useSetMuted();
  const line = useMemberLine(chat.peerId);
  const peer = chat.peerId ? chatMembers[chat.peerId] : null;
  const names = chat.memberIds.map((id) => chatMembers[id]?.short).filter(Boolean);
  const membersLine =
    chat.kind === 'channel'
      ? [
          t('chat.members', { count: names.length }),
          names.slice(0, 3).join(', ') +
            (names.length > 3 ? ` ${t('chat.membersMore', { count: names.length - 3 })}` : ''),
        ].join(' · ')
      : line;
  const item =
    'flex h-[34px] cursor-pointer items-center rounded-[7px] px-3 text-[12px] text-sub outline-none data-[highlighted]:bg-popover-active data-[highlighted]:text-text';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/chat?c=${chat.id}`);
      toast.success({ title: t('chat.linkCopied') });
    } catch {
      toast.error({ title: t('errors.unknown') });
    }
  };

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-[10px] border-b border-line px-5">
      {peer ? <MemberAvatar member={peer} /> : <ChannelIcon />}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[14px] font-semibold tracking-[-0.2px] text-text">
          {chat.fullTitle}
        </h2>
        <p className="mt-[3px] flex items-center gap-[5px] truncate text-[11px] text-dim">
          {chat.kind === 'channel' && <GroupIcon size={14} className="shrink-0" />}
          {membersLine}
          {chat.muted && ` · ${t('chat.muted')}`}
        </p>
      </div>
      <DropdownMenu.Root>
        <Tooltip content={t('access.actions')}>
          <DropdownMenu.Trigger
            aria-label={t('access.actions')}
            className="flex size-7 items-center justify-center rounded-6 text-faint hover:bg-row-highlight hover:text-text data-[state=open]:bg-row-highlight"
          >
            <MoreIcon size={16} />
          </DropdownMenu.Trigger>
        </Tooltip>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 w-[260px] rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
          >
            <DropdownMenu.Label className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[1.2px] text-dim">
              {t('chat.membersTitle')}
            </DropdownMenu.Label>
            {chat.memberIds.map((id) => {
              const m = chatMembers[id];
              return m ? (
                <div key={id} className="flex items-center gap-[9px] px-3 py-[6px]">
                  <MemberAvatar member={m} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-text">
                      {m.name}
                      {id === currentMemberId && ` · ${t('access.you')}`}
                    </span>
                    <span className="block truncate text-[10.5px] text-dim">
                      {m.role} · {t(`access.roles.${m.role}`)}
                    </span>
                  </span>
                </div>
              ) : null;
            })}
            <DropdownMenu.Separator className="my-[5px] h-px bg-line" />
            <DropdownMenu.Item
              onSelect={() => setMuted.mutate({ chatId: chat.id, muted: !chat.muted })}
              className={item}
            >
              {chat.muted ? t('chat.unmute') : t('chat.mute')}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={copyLink} className={item}>
              {t('chat.copyLink')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}

function Message({
  message: m,
  peerName,
  replies,
  onThread,
}: {
  message: ChatMessage;
  peerName?: string;
  /** Ответы в ветке к этому сообщению */
  replies?: ChatMessage[];
  /** Открыть ветку; только в каналах департаментов */
  onThread?: () => void;
}) {
  const { t } = useTranslation();
  if (m.kind === 'system') return <SystemMessage message={m} peerName={peerName ?? ''} />;
  if (m.kind === 'task') return <TaskCard message={m} />;
  const author = m.authorId ? chatMembers[m.authorId] : null;
  if (!author) return null;
  return (
    <article className="group mt-[10px] flex gap-[10px] py-1">
      <MemberAvatar member={author} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="text-[13px] font-medium tracking-[-0.1px] text-text">{author.name}</span>
          <RoleChip role={author.role} />
          <time dateTime={m.at} className="text-[10.5px] text-dim">
            {timeOf(m.at)}
          </time>
        </p>
        {m.text && (
          <p className="mt-[3px] whitespace-pre-wrap break-words text-[13px] leading-[19px] text-sub">
            <MessageText text={m.text} />
          </p>
        )}
        {m.file && (
          <span className="mt-[6px] inline-flex h-9 items-center gap-2 rounded-8 border border-line bg-surface px-3 text-[12px] text-sub">
            <AttachLargeIcon size={16} className="text-faint" />
            {m.file.name}
            {m.file.ext && <span className="text-[10.5px] text-dim">{m.file.ext}</span>}
          </span>
        )}
        {onThread &&
          (replies && replies.length > 0 ? (
            <button
              type="button"
              onClick={onThread}
              className="mt-[6px] flex items-center gap-2 text-[12px] font-medium text-info hover:underline"
            >
              {t('chat.thread.replies', { count: replies.length })}
              <span className="font-normal text-dim">
                {t('chat.thread.last', { time: timeOf(replies[replies.length - 1].at) })}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onThread}
              className="mt-[4px] text-[11.5px] text-faint opacity-0 hover:text-info focus-visible:opacity-100 group-hover:opacity-100"
            >
              {t('chat.thread.reply')}
            </button>
          ))}
      </div>
    </article>
  );
}

/** Карточка задачи из доски; статус — живой, из задач, если задача найдена */
function TaskCard({ message: m }: { message: ChatMessage }) {
  const { t, i18n } = useTranslation();
  const tasks = useTasks('department').data;
  if (!m.task) return null;
  const live = tasks?.find((x) => x.title === m.task?.title);
  const status = live?.status ?? m.task.status;
  const due = live ? live.due : m.task.due;
  const assignee = live?.assignee?.short ?? m.task.assignee;
  const meta = due
    ? t('chat.taskMeta', { assignee, date: shortDay(due, i18n.language) })
    : t('chat.taskNoDue', { assignee });
  const statusTone: Record<string, string> = {
    queue: 'bg-chip text-chip-text',
    in_progress: 'bg-info-chip text-info',
    review: 'bg-warning-chip text-warning-strong',
    done: 'bg-success-chip text-success',
  };
  const body = (
    <>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[2.5px] rounded-l-9 bg-info" />
      <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-info">
        <TasksIcon size={16} />
        {t('chat.taskFromBoard')}
      </span>
      <span className="mt-2 block text-[13px] font-medium text-text">{m.task.title}</span>
      <span className="mt-[6px] flex items-center gap-[10px]">
        <span
          className={`flex h-[18px] items-center rounded-[5px] px-[7px] text-[10px] font-medium ${statusTone[status]}`}
        >
          {t(`tasks.status.${status}`)}
        </span>
        <span className="text-[11px] text-dim">{meta}</span>
        <ArrowRightIcon size={14} className="ml-auto text-faint" />
      </span>
    </>
  );
  const box =
    'relative ml-[42px] mt-[6px] block overflow-hidden rounded-9 border border-info-line bg-info-chip px-4 pb-3 pt-[13px]';
  return live ? (
    <Link
      to={`/tasks?task=${live.id}`}
      aria-label={`${t('chat.openTask')}: ${m.task.title}`}
      className={`${box} hover:opacity-90`}
    >
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

function SystemMessage({ message: m, peerName }: { message: ChatMessage; peerName: string }) {
  const { t, i18n } = useTranslation();
  if (m.system?.kind === 'autoreply') {
    return (
      <p
        role="note"
        className="ml-[42px] mt-[6px] rounded-9 border border-line bg-surface px-[14px] py-[9px] text-[12px] text-sub"
      >
        <span className="font-medium text-text">{t('chat.autoreplyTitle')}: </span>
        {t('chat.autoreplyText', {
          name: peerName,
          date: formatIsoDate(m.system.title, 'd MMMM', i18n.language),
          deputy: m.text,
        }).trim()}
      </p>
    );
  }
  return (
    <div
      role="note"
      className="mt-[10px] flex gap-[10px] rounded-9 border border-warning-line bg-warning-soft px-4 py-[9px]"
    >
      <BoltIcon size={16} className="mt-[2px] shrink-0 text-warning" />
      <div>
        <p className="text-[12px] font-semibold text-warning-strong">{m.system?.title}</p>
        <p className="mt-[2px] text-[11px] text-warning-muted">{m.text}</p>
      </div>
    </div>
  );
}

/** Поле ввода: Enter — отправить, Shift+Enter — новая строка; файл и задача — кнопками */
function Composer({ chat }: { chat: ChatSummary }) {
  const { t } = useTranslation();
  const send = useSendMessage();
  const [text, setText] = useState('');
  const [picking, setPicking] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const submit = () => {
    const clean = text.trim();
    if (!clean) return;
    send.mutate({ chatId: chat.id, message: { kind: 'text', text: clean } });
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  const attach = (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      const dot = f.name.lastIndexOf('.');
      send.mutate({
        chatId: chat.id,
        message: {
          kind: 'text',
          text: '',
          file: {
            name: dot > 0 ? f.name.slice(0, dot) : f.name,
            ext: dot > 0 ? f.name.slice(dot + 1).toLowerCase() : '',
          },
        },
      });
    }
  };
  const icon =
    'flex size-7 items-center justify-center rounded-6 text-faint hover:bg-row-highlight hover:text-text';
  const placeholder =
    chat.kind === 'channel' ? t('chat.placeholderChannel') : t('chat.placeholderDirect');

  return (
    <div className="shrink-0 px-5 pb-[10px]">
      <div className="flex items-end gap-[6px] rounded-11 border border-line bg-column py-[10px] pl-4 pr-[10px] focus-within:border-info">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          aria-label={placeholder}
          placeholder={placeholder}
          className="max-h-32 min-h-7 flex-1 resize-none bg-transparent py-[5px] text-[13px] leading-[18px] text-text outline-none placeholder:text-dim [field-sizing:content]"
        />
        <Tooltip content={t('chat.attachFile')}>
          <button
            type="button"
            aria-label={t('chat.attachFile')}
            onClick={() => file.current?.click()}
            className={icon}
          >
            <PaperclipIcon size={16} />
          </button>
        </Tooltip>
        <Tooltip content={t('chat.attachTask')}>
          <button
            type="button"
            aria-label={t('chat.attachTask')}
            onClick={() => setPicking(true)}
            className={icon}
          >
            <TasksIcon size={16} />
          </button>
        </Tooltip>
        <Tooltip content={t('chat.send')}>
          <button
            type="button"
            aria-label={t('chat.send')}
            disabled={!text.trim()}
            onClick={submit}
            className={`${icon} !text-info disabled:opacity-40`}
          >
            <SendIcon size={16} />
          </button>
        </Tooltip>
        <input
          ref={file}
          type="file"
          multiple
          hidden
          aria-label={t('chat.attachFile')}
          onChange={(e) => {
            attach(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      <p className="mt-[6px] text-[10.5px] text-dim">{t('chat.inputHint')}</p>
      <TaskPickerDialog
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(task) => {
          setPicking(false);
          send.mutate({
            chatId: chat.id,
            message: {
              kind: 'task',
              text: '',
              task: {
                title: task.title,
                status: task.status,
                assignee: task.assignee?.short ?? '—',
                due: task.due,
              },
            },
          });
        }}
      />
    </div>
  );
}

/** Ветка ответов к сообщению канала (S-33): справа, со своим полем ввода */
function ThreadPanel({
  chat,
  root,
  replies,
  onClose,
}: {
  chat: ChatSummary;
  root: ChatMessage;
  replies: ChatMessage[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const send = useSendMessage();
  const [text, setText] = useState('');
  const submit = () => {
    const clean = text.trim();
    if (!clean) return;
    send.mutate({ chatId: chat.id, message: { kind: 'text', text: clean, threadId: root.id } });
    setText('');
  };
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.35)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-4 right-4 z-50 flex w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <div className="border-b border-line px-5 py-4 pr-14">
            <Dialog.Title className="text-[14px] font-semibold text-text">
              {t('chat.thread.title')}
            </Dialog.Title>
            <p className="mt-[2px] text-[11.5px] text-faint">{chat.fullTitle}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
            <Message message={root} />
            <p className="my-3 flex items-center gap-3 text-[10.5px] text-dim">
              <span className="h-px flex-1 bg-line" />
              {t('chat.thread.replies', { count: replies.length })}
              <span className="h-px flex-1 bg-line" />
            </p>
            {replies.map((r) => (
              <Message key={r.id} message={r} />
            ))}
          </div>
          <div className="border-t border-line p-3">
            <textarea
              aria-label={t('chat.thread.placeholder')}
              placeholder={t('chat.thread.placeholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              className="w-full resize-none rounded-9 border border-line bg-column px-3 py-2 text-[13px] text-text outline-none placeholder:text-dim focus:border-info"
            />
          </div>
          <Dialog.Close
            aria-label={t('taskCard.close')}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
