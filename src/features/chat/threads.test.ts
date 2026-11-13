import { describe, expect, it } from 'vitest';
import { fetchChats, fetchMessages, sendMessage, threadsOf } from './api';

// Подставной сервер чата ставится перед каждым тестом (src/test/setup.ts)
describe('ветки в каналах (S-33)', () => {
  it('ответы в ветке собраны под сообщением', async () => {
    const threads = threadsOf(await fetchMessages('c-admin'));
    expect(threads.get('m-2')?.map((m) => m.text)).toEqual([
      'Сверку перевода с юристом начну завтра с утра.',
      'Хорошо. Главы 5–9 нужны к пятнице.',
    ]);
  });

  it('ответ в ветке не становится последним сообщением канала в списке', async () => {
    const before = (await fetchChats()).find((c) => c.id === 'c-admin')?.last?.id;
    await sendMessage('c-admin', { kind: 'text', text: 'Ответ в ветке', threadId: 'm-2' });
    expect((await fetchChats()).find((c) => c.id === 'c-admin')?.last?.id).toBe(before);
    expect(threadsOf(await fetchMessages('c-admin')).get('m-2')).toHaveLength(3);
  });

  it('догрузка только новых сообщений (after)', async () => {
    const all = await fetchMessages('c-admin');
    const sent = await sendMessage('c-admin', { kind: 'text', text: 'Новое' });
    expect((await fetchMessages('c-admin', all.at(-1)?.id)).map((m) => m.id)).toEqual([sent.id]);
  });
});
