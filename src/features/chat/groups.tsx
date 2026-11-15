import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentPersonId } from '@/features/auth';
import { CheckTinyIcon, XIcon } from '@/shared/ui/icons';
import {
  useAddGroupMembers,
  useChatMembers,
  useCreateGroup,
  useRemoveGroupMember,
  useUpdateGroup,
} from './api';
import { PickerDialog, SearchBox } from './dialogs';
import { MemberAvatar, useMemberLine } from './parts';
import type { ChatMember, ChatSummary } from './types';

/**
 * Группы чата: создание (название, описание, участники) и сведения о группе. Название
 * и описание меняет любой участник, добавить участников может любой, убрать другого — только
 * создатель, выйти — каждый (сообщения остаются). Правила — на бэкенде (apps/chat/services.py).
 */

export const GROUP_TITLE_MIN = 2;
export const GROUP_TITLE_MAX = 80;
export const GROUP_DESCRIPTION_MAX = 1000;

const label = 'text-[10.5px] font-medium tracking-[0.2px] text-sub';
const field =
  'mt-[6px] w-full shrink-0 rounded-8 border border-line bg-column px-[13px] text-[12.5px] text-text outline-none placeholder:text-dim focus:border-info data-[invalid=true]:border-danger';
const primary =
  'flex h-9 items-center gap-2 rounded-9 bg-brand-red px-4 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90 disabled:opacity-60';
const secondary =
  'flex h-9 items-center rounded-9 border border-line px-4 text-[12.5px] font-medium text-sub hover:text-text disabled:opacity-60';

const titleOk = (title: string) => {
  const n = title.trim().split(/\s+/).filter(Boolean).join(' ').length;
  return n >= GROUP_TITLE_MIN && n <= GROUP_TITLE_MAX;
};

/** Сотрудники с отметками: кого добавить в группу */
function MemberPicker({
  selected,
  onToggle,
  exclude,
  autoFocus = true,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  exclude: Set<string>;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const chatMembers = useChatMembers();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const people = Object.values(chatMembers).filter(
    (m) =>
      !exclude.has(m.id) &&
      m.active !== false &&
      (!needle || [m.name, m.department].some((v) => v.toLowerCase().includes(needle))),
  );
  return (
    <>
      <SearchBox
        value={query}
        onChange={setQuery}
        label={t('chat.pickGroupMembers')}
        autoFocus={autoFocus}
      />
      <ul className="mt-2 min-h-[120px] flex-1 overflow-y-auto">
        {people.map((m) => (
          <PickRow
            key={m.id}
            member={m}
            checked={selected.has(m.id)}
            onToggle={() => onToggle(m.id)}
          />
        ))}
        {people.length === 0 && (
          <li className="py-6 text-center text-[12px] text-dim">{t('chat.nothingFound')}</li>
        )}
      </ul>
    </>
  );
}

function PickRow({
  member,
  checked,
  onToggle,
}: {
  member: ChatMember;
  checked: boolean;
  onToggle: () => void;
}) {
  const line = useMemberLine(member.id);
  return (
    <li>
      <label className="flex w-full cursor-pointer items-center gap-[10px] rounded-9 px-2 py-[7px] hover:bg-row-highlight">
        <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
        <span
          aria-hidden
          className={`flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border ${
            checked ? 'border-info bg-info text-[#FFFFFF]' : 'border-line'
          }`}
        >
          {checked && <CheckTinyIcon size={12} />}
        </span>
        <MemberAvatar member={member} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-text">{member.name}</span>
          <span className="block truncate text-[10.5px] text-dim">{line}</span>
        </span>
      </label>
    </li>
  );
}

const toggled = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Форма новой группы (внутри окна «Новая переписка») */
export function NewGroupForm({
  onCreated,
  onCancel,
}: {
  onCreated: (chatId: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const me = useCurrentPersonId() ?? '';
  const create = useCreateGroup();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tried, setTried] = useState(false);
  const titleError = tried && !titleOk(title);
  const membersError = tried && selected.size === 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!titleOk(title) || selected.size === 0) return;
    create
      .mutateAsync({
        title: title.trim(),
        description: description.trim(),
        memberIds: [...selected],
      })
      .then(onCreated)
      .catch(() => null);
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex min-h-0 flex-1 flex-col">
      <label htmlFor="group-title" className={label}>
        {t('chat.groupTitle')}
      </label>
      <input
        id="group-title"
        // biome-ignore lint/a11y/noAutofocus: окно открыто ради этой формы
        autoFocus
        value={title}
        maxLength={GROUP_TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('chat.groupTitlePlaceholder')}
        data-invalid={titleError}
        aria-invalid={titleError}
        className={`${field} h-9`}
      />
      {titleError && (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {t('chat.groupTitleError')}
        </p>
      )}
      <label htmlFor="group-description" className={`${label} mt-3`}>
        {t('chat.groupDescription')}
      </label>
      <textarea
        id="group-description"
        rows={2}
        value={description}
        maxLength={GROUP_DESCRIPTION_MAX}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('chat.groupDescriptionPlaceholder')}
        className={`${field} resize-none py-2 leading-[18px]`}
      />
      <p className={`${label} mt-3 flex justify-between`}>
        <span>{t('chat.groupMembers')}</span>
        <span className="text-dim">{t('chat.groupMembersPicked', { count: selected.size })}</span>
      </p>
      <MemberPicker
        selected={selected}
        onToggle={(id) => setSelected((s) => toggled(s, id))}
        exclude={new Set([me])}
        autoFocus={false}
      />
      {membersError && (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {t('chat.groupMembersError')}
        </p>
      )}
      <div className="mt-3 flex shrink-0 gap-2">
        <button type="submit" disabled={create.isPending} className={primary}>
          {t('chat.groupCreate')}
        </button>
        <button type="button" onClick={onCancel} className={secondary}>
          {t('chat.cancel')}
        </button>
      </div>
    </form>
  );
}

/** Сведения о группе: название, описание, участники, выход */
export function GroupInfoDialog({
  chat,
  open,
  onClose,
  onLeft,
}: {
  chat: ChatSummary;
  open: boolean;
  onClose: () => void;
  onLeft: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PickerDialog open={open} title={t('chat.groupInfo')} onClose={onClose}>
      <GroupInfo chat={chat} onLeft={onLeft} />
    </PickerDialog>
  );
}

function GroupInfo({ chat, onLeft }: { chat: ChatSummary; onLeft: () => void }) {
  const { t } = useTranslation();
  const me = useCurrentPersonId() ?? '';
  const chatMembers = useChatMembers();
  const update = useUpdateGroup();
  const add = useAddGroupMembers();
  const remove = useRemoveGroupMember();
  const [title, setTitle] = useState(chat.title);
  const [description, setDescription] = useState(chat.description ?? '');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState(false);
  const isCreator = chat.createdById === me;
  const creator = chat.createdById ? chatMembers[chat.createdById] : null;
  const changed =
    title.trim() !== chat.title || description.trim() !== (chat.description ?? '').trim();
  const titleError = !titleOk(title);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (titleError || !changed) return;
    update.mutate({ chatId: chat.id, title: title.trim(), description: description.trim() });
  };

  if (adding) {
    return (
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <MemberPicker
          selected={picked}
          onToggle={(id) => setPicked((s) => toggled(s, id))}
          exclude={new Set(chat.memberIds)}
        />
        <div className="mt-3 flex shrink-0 gap-2">
          <button
            type="button"
            disabled={picked.size === 0 || add.isPending}
            onClick={() =>
              add
                .mutateAsync({ chatId: chat.id, memberIds: [...picked] })
                .then(() => {
                  setPicked(new Set());
                  setAdding(false);
                })
                .catch(() => null)
            }
            className={primary}
          >
            {t('chat.groupAdd')}
            {picked.size > 0 && ` · ${picked.size}`}
          </button>
          <button type="button" onClick={() => setAdding(false)} className={secondary}>
            {t('chat.cancel')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
      <form onSubmit={save} noValidate>
        <label htmlFor="group-info-title" className={label}>
          {t('chat.groupTitle')}
        </label>
        <input
          id="group-info-title"
          value={title}
          maxLength={GROUP_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          data-invalid={titleError}
          aria-invalid={titleError}
          className={`${field} h-9`}
        />
        {titleError && (
          <p role="alert" className="mt-1 text-[11px] text-danger">
            {t('chat.groupTitleError')}
          </p>
        )}
        <label htmlFor="group-info-description" className={`${label} mt-3 block`}>
          {t('chat.groupDescription')}
        </label>
        <textarea
          id="group-info-description"
          rows={3}
          value={description}
          maxLength={GROUP_DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('chat.groupNoDescription')}
          className={`${field} resize-none py-2 leading-[18px]`}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={!changed || titleError || update.isPending}
            className={primary}
          >
            {t('chat.groupSave')}
          </button>
          {creator && (
            <span className="truncate text-[11px] text-dim">
              {t('chat.groupCreatedBy', { name: creator.name })}
            </span>
          )}
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between">
        <h3 className={label}>
          {t('chat.groupMembers')} · {chat.memberIds.length}
        </h3>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-[12px] font-medium text-info hover:opacity-90"
        >
          + {t('chat.groupAdd')}
        </button>
      </div>
      <ul className="mt-2">
        {chat.memberIds.map((id) => {
          const m = chatMembers[id];
          if (!m) return null;
          return (
            <li key={id} className="flex items-center gap-[10px] rounded-9 px-2 py-[6px]">
              <MemberAvatar member={m} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-text">
                  {m.name}
                  {id === me && ` · ${t('access.you')}`}
                </span>
                <span className="block truncate text-[10.5px] text-dim">
                  {id === chat.createdById ? `${t('chat.creator')} · ` : ''}
                  {m.department}
                </span>
              </span>
              {isCreator && id !== me && (
                <button
                  type="button"
                  aria-label={`${t('chat.groupRemove')}: ${m.name}`}
                  title={t('chat.groupRemove')}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ chatId: chat.id, memberId: id })}
                  className="flex size-7 items-center justify-center rounded-6 text-faint hover:bg-row-highlight hover:text-danger"
                >
                  <XIcon size={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-line pt-3">
        {leaving ? (
          <div>
            <p className="text-[12px] text-sub">
              {t('chat.groupLeaveConfirm', { title: chat.title })}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() =>
                  remove
                    .mutateAsync({ chatId: chat.id, memberId: me })
                    .then(onLeft)
                    .catch(() => null)
                }
                className={primary}
              >
                {t('chat.groupLeave')}
              </button>
              <button type="button" onClick={() => setLeaving(false)} className={secondary}>
                {t('chat.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLeaving(true)}
            className="text-[12px] font-medium text-danger hover:opacity-90"
          >
            {t('chat.groupLeave')}
          </button>
        )}
      </div>
    </div>
  );
}
