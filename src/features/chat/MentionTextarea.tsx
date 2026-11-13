import { type KeyboardEvent, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentPersonId } from '@/features/auth';
import { useChatMembers } from './api';
import { insertMention, mentionAt, mentionCandidates } from './mentions';
import { MemberAvatar } from './parts';
import type { ChatMember, ChatSummary } from './types';

type Props = {
  chat: ChatSummary;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  rows?: number;
  className: string;
};

export function MentionTextarea({
  chat,
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 1,
  className,
}: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const members = useChatMembers();
  const me = useCurrentPersonId();
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);

  const people = useMemo(
    () =>
      chat.memberIds
        .filter((id) => id !== me)
        .map((id) => members[id])
        .filter((m): m is ChatMember => Boolean(m)),
    [chat.memberIds, members, me],
  );
  const draft = mentionAt(value, caret);
  const candidates =
    draft && draft.start !== dismissed ? mentionCandidates(people, draft.query) : [];
  const open = candidates.length > 0;
  const current = Math.min(active, candidates.length - 1);

  const track = () => setCaret(area.current?.selectionStart ?? value.length);

  const pick = (member: ChatMember) => {
    if (!draft) return;
    const next = insertMention(value, draft, member);
    onChange(next.text);
    setCaret(next.caret);
    setActive(0);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setActive((current + step + candidates.length) % candidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(candidates[current]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setDismissed(draft?.start ?? null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={t('chat.mentionList')}
          className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-9 border border-line bg-surface py-1 shadow-lg"
        >
          {candidates.map((m, i) => (
            <div
              key={m.id}
              id={`${listId}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === current}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full cursor-pointer items-center gap-2 px-3 py-[6px] ${
                i === current ? 'bg-row-highlight' : ''
              }`}
            >
              <MemberAvatar member={m} size={30} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-text">{m.name}</span>
                <span className="block truncate text-[11px] text-sub">{m.department}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={area}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setActive(0);
          setDismissed(null);
        }}
        onSelect={track}
        onKeyDown={onKeyDown}
        onBlur={() => setDismissed(draft?.start ?? null)}
        onFocus={() => setDismissed(null)}
        rows={rows}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${current}` : undefined}
        aria-autocomplete="list"
        aria-label={placeholder}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}
