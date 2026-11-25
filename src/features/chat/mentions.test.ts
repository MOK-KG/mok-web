import { describe, expect, it } from 'vitest';
import { insertMention, mentionAt, mentionCandidates, messageParts } from './mentions';
import type { ChatMember } from './types';

const member = (id: string, name: string, short: string, active = true): ChatMember => ({
  id,
  name,
  short,
  tone: 'blue',
  role: 'R5',
  department: 'Юридический отдел',
  active,
});

const members = [
  member('1', 'Нурлан Бакиров', 'Н. Бакиров'),
  member('2', 'Дамира Токтосунова', 'Д. Токтосунова'),
  member('3', 'Айбек Дуйшеев', 'А. Дуйшеев'),
  member('4', 'Канат Асанов', 'К. Асанов', false),
];

describe('mentionAt', () => {
  it('finds the query after @ before the caret', () => {
    expect(mentionAt('Привет @Нур', 11)).toEqual({ start: 7, end: 11, query: 'Нур' });
  });

  it('starts right after a bare @', () => {
    expect(mentionAt('@', 1)).toEqual({ start: 0, end: 1, query: '' });
  });

  it('allows one space for «Н. Бакиров»', () => {
    expect(mentionAt('@Н. Бак', 7)?.query).toBe('Н. Бак');
  });

  it('ignores e-mail addresses', () => {
    expect(mentionAt('info@olympic', 12)).toBeNull();
  });

  it('stops after a finished mention and more words', () => {
    expect(mentionAt('@Н. Бакиров посмотрите', 22)).toBeNull();
  });

  it('stops at a new line', () => {
    expect(mentionAt('@Нур\nдальше', 11)).toBeNull();
  });

  it('is empty without @', () => {
    expect(mentionAt('просто текст', 6)).toBeNull();
  });
});

describe('mentionCandidates', () => {
  it('matches by full and short name, case-insensitive', () => {
    expect(mentionCandidates(members, 'бак').map((m) => m.id)).toEqual(['1']);
    expect(mentionCandidates(members, 'д. ток').map((m) => m.id)).toEqual(['2']);
  });

  it('lists everyone active for an empty query, sorted by name', () => {
    expect(mentionCandidates(members, '').map((m) => m.id)).toEqual(['3', '2', '1']);
  });

  it('skips people who left', () => {
    expect(mentionCandidates(members, 'асанов')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(mentionCandidates(members, '', 2)).toHaveLength(2);
  });
});

describe('insertMention', () => {
  it('replaces the query with the short name and a space', () => {
    const text = 'Привет @нур, глянь';
    const draft = { start: 7, end: 11, query: 'нур' };
    expect(insertMention(text, draft, members[0])).toEqual({
      text: 'Привет @Н. Бакиров, глянь',
      caret: 18,
    });
  });

  it('does not double the space before the rest', () => {
    const text = '@нур завтра';
    expect(insertMention(text, { start: 0, end: 4, query: 'нур' }, members[0]).text).toBe(
      '@Н. Бакиров завтра',
    );
  });

  it('adds a space at the end of the text', () => {
    expect(insertMention('@нур', { start: 0, end: 4, query: 'нур' }, members[0])).toEqual({
      text: '@Н. Бакиров ',
      caret: 12,
    });
  });
});

describe('ссылки и упоминания в тексте сообщения', () => {
  it('ссылка кликабельна, знаки препинания после неё — обычный текст', () => {
    expect(messageParts('См. https://olympic.kg/docs?id=1, и www.noc.kg. @Н. Бакиров')).toEqual([
      { kind: 'text', value: 'См. ' },
      { kind: 'link', value: 'https://olympic.kg/docs?id=1', href: 'https://olympic.kg/docs?id=1' },
      { kind: 'text', value: ', и ' },
      { kind: 'link', value: 'www.noc.kg', href: 'https://www.noc.kg' },
      { kind: 'text', value: '. ' },
      { kind: 'mention', value: '@Н. Бакиров' },
    ]);
  });

  it('без ссылок — один текст', () => {
    expect(messageParts('javascript:alert(1)')).toEqual([
      { kind: 'text', value: 'javascript:alert(1)' },
    ]);
  });
});
