import type { ChatMember } from './types';

export type MentionDraft = { start: number; end: number; query: string };

const MAX_QUERY = 30;

export function mentionAt(text: string, caret: number): MentionDraft | null {
  const start = text.lastIndexOf('@', caret - 1);
  if (start < 0) return null;
  if (start > 0 && !/\s/.test(text[start - 1])) return null;
  const query = text.slice(start + 1, caret);
  if (query.length > MAX_QUERY || /\n/.test(query)) return null;
  if ((query.match(/ /g) ?? []).length > 1) return null;
  return { start, end: caret, query };
}

export function mentionCandidates(members: ChatMember[], query: string, limit = 6): ChatMember[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  return members
    .filter(
      (m) =>
        m.active !== false &&
        (!needle ||
          m.name.toLocaleLowerCase('ru').includes(needle) ||
          m.short.toLocaleLowerCase('ru').includes(needle)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .slice(0, limit);
}

export function insertMention(text: string, draft: MentionDraft, member: ChatMember) {
  const rest = text.slice(draft.end);
  const inserted = `@${member.short}${/^[\s,.!?:;)]/.test(rest) ? '' : ' '}`;
  return {
    text: text.slice(0, draft.start) + inserted + rest,
    caret: draft.start + inserted.length,
  };
}
