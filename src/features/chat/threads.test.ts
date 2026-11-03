import { beforeEach, describe, expect, it } from 'vitest';
import { fetchChats, fetchMessages, resetChatMock, sendMessage, threadsOf } from './api';

beforeEach(() => resetChatMock());

describe('ветки в каналах (S-33)', () => {
  it('ответы в ветке собраны под сообщением', () => {
    const threads = threadsOf(fetchMessages('c-admin'));
    expect(threads.get('m-2')?.map((m) => m.text)).toEqual([
      'Сверку перевода с юристом начну завтра с утра.',
      'Хорошо. Главы 5–9 нужны к пятнице.',
    ]);
  });

  it('ответ в ветке не становится последним сообщением канала в списке', () => {
    const before = fetchChats().find((c) => c.id === 'c-admin')?.last?.id;
    sendMessage('c-admin', { kind: 'text', text: 'Ответ в ветке', threadId: 'm-2' });
    expect(fetchChats().find((c) => c.id === 'c-admin')?.last?.id).toBe(before);
    expect(threadsOf(fetchMessages('c-admin')).get('m-2')).toHaveLength(3);
  });
});
