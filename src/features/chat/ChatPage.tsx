import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { PlusIcon, SearchIcon } from '@/shared/ui/icons';
import { chatMembers, currentMemberId, useChats, useChatUnread } from './api';
import { Conversation } from './Conversation';
import { NewChatDialog } from './dialogs';
import {
  ChannelIcon,
  dayOf,
  MemberAvatar,
  shortDay,
  timeOf,
  useDayLabel,
  useMemberLine,
  usePreview,
} from './parts';
import type { ChatSummary } from './types';

/**
 * Чат: слева — каналы департаментов и личные переписки, справа — открытая переписка.
 * Открытый чат — в адресе (?c=ID), чтобы на него можно было сослаться из уведомления.
 */
export function ChatPage() {
  const { t } = useTranslation();
  const chats = useChats();
  const unread = useChatUnread() ?? 0;
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  usePageSubtitle(unread > 0 ? t('chat.unread', { count: unread }) : t('chat.allRead'));

  const list = chats.data ?? [];
  const openId = params.get('c');
  const open = list.find((c) => c.id === openId) ?? null;
  const select = (id: string) => setParams({ c: id }, { replace: !openId });

  // Без ?c= — первая переписка списка, как в макете
  useEffect(() => {
    if (!openId && list.length > 0) setParams({ c: list[0].id }, { replace: true });
  }, [openId, list, setParams]);

  const needle = query.trim().toLowerCase();
  const shown = list.filter(
    (c) => !needle || [c.title, c.fullTitle].some((v) => v.toLowerCase().includes(needle)),
  );

  return (
    <div className="flex h-full min-h-[560px] gap-[14px] leading-[normal]">
      <nav
        aria-label={t('chat.title')}
        className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-14 border border-line bg-panel"
      >
        <div className="flex items-center gap-2 px-3 pb-3 pt-3">
          <label className="relative flex h-8 flex-1 items-center">
            <SearchIcon size={16} className="pointer-events-none absolute left-[10px] text-dim" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('chat.search')}
              aria-label={t('chat.search')}
              className="h-full w-full rounded-9 border border-line bg-column pl-[34px] pr-[10px] text-[12px] text-text outline-none placeholder:text-dim focus:border-info"
            />
          </label>
          <button
            type="button"
            aria-label={t('chat.newChat')}
            title={t('chat.newChat')}
            onClick={() => setCreating(true)}
            className="flex size-8 shrink-0 items-center justify-center rounded-9 bg-brand-red text-[#FFFFFF] hover:opacity-90"
          >
            <PlusIcon size={16} />
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto border-t border-line">
          {shown.map((c) => (
            <ChatRow
              key={c.id}
              chat={c}
              selected={c.id === open?.id}
              onSelect={() => select(c.id)}
            />
          ))}
          {chats.data && shown.length === 0 && (
            <li className="px-4 py-8 text-center text-[12px] text-dim">{t('chat.nothingFound')}</li>
          )}
        </ul>
      </nav>

      <section
        aria-label={open?.fullTitle ?? t('chat.title')}
        className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-14 border border-line bg-panel"
      >
        {open ? (
          <Conversation key={open.id} chat={open} />
        ) : (
          chats.data && <p className="m-auto text-[12.5px] text-dim">{t('chat.selectChat')}</p>
        )}
      </section>

      <NewChatDialog
        open={creating}
        onClose={() => setCreating(false)}
        onOpened={(id) => {
          setCreating(false);
          setParams({ c: id });
        }}
      />
    </div>
  );
}

function ChatRow({
  chat: c,
  selected,
  onSelect,
}: {
  chat: ChatSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation();
  const preview = usePreview();
  const dayLabel = useDayLabel();
  const line = useMemberLine(c.peerId);
  const peer = c.peerId ? chatMembers[c.peerId] : null;
  const when = c.last
    ? dayOf(c.last.at) === dayOf(new Date().toISOString())
      ? timeOf(c.last.at)
      : dayOf(c.last.at) === dayOf(new Date(Date.now() - 86_400_000).toISOString())
        ? dayLabel(dayOf(c.last.at)).toLowerCase()
        : shortDay(dayOf(c.last.at), i18n.language)
    : '';

  return (
    <li className="px-0">
      <button
        type="button"
        aria-current={selected ? 'page' : undefined}
        onClick={onSelect}
        className={`relative flex w-full gap-3 border-b border-line px-[14px] py-[11px] text-left ${
          selected ? 'bg-nav-active' : 'hover:bg-row-highlight'
        }`}
      >
        {selected && (
          <span aria-hidden className="absolute inset-y-0 left-0 w-[2.5px] bg-brand-red" />
        )}
        {peer ? <MemberAvatar member={peer} /> : <ChannelIcon />}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.1px] text-text">
              {c.title}
            </span>
            <span className="shrink-0 text-[10px] text-dim">{when}</span>
          </span>
          <span className="mt-[2px] block truncate text-[10px] text-dim">
            {c.kind === 'channel'
              ? `${t('chat.channel')} · ${t('chat.members', { count: c.memberIds.length })}`
              : line}
            {c.muted && ` · ${t('chat.muted')}`}
          </span>
          <span className="mt-[3px] flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-sub">
              {preview(c.last, currentMemberId)}
            </span>
            {c.unread > 0 && (
              <span
                className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] font-semibold ${
                  c.muted ? 'bg-chip text-chip-text' : 'bg-brand-red text-[#FFFFFF]'
                }`}
              >
                {c.unread}
                <span className="sr-only"> {t('chat.unread', { count: c.unread })}</span>
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
