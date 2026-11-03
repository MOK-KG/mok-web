import { beforeEach, describe, expect, it } from 'vitest';
import { addJournalEntry, journalEntries, resetJournal, verifyJournal } from './store';

beforeEach(() => resetJournal());

describe('журнал действий', () => {
  it('записи только добавляются и связаны цепочкой хешей', () => {
    const a = addJournalEntry({ author: 'К. Асанов', action: 'documentSent', details: 'Исх. №1' });
    const b = addJournalEntry({ author: 'К. Асанов', action: 'documentSent', details: 'Исх. №2' });
    expect(a.prevHash).toBe('00000000');
    expect(b.prevHash).toBe(a.hash);
    expect(verifyJournal()).toEqual({ ok: true, checked: 2, brokenAt: null });
  });

  it('изменить журнал через выданные записи нельзя', () => {
    addJournalEntry({ author: 'К. Асанов', action: 'documentSent', details: 'Исх. №1' });
    const copy = journalEntries() as unknown as { details: string }[];
    copy[0].details = 'подмена';
    expect(journalEntries()[0].details).toBe('Исх. №1');
  });

  it('правка или удаление записи ломает проверку целостности', () => {
    for (const n of [1, 2, 3]) {
      addJournalEntry({ author: 'К. Асанов', action: 'documentSent', details: `Исх. №${n}` });
    }
    const entries = journalEntries();
    const edited = entries.map((e, i) => (i === 1 ? { ...e, details: 'подмена' } : e));
    expect(verifyJournal(edited)).toMatchObject({ ok: false, brokenAt: entries[1].id });
    const removed = entries.filter((_, i) => i !== 1);
    expect(verifyJournal(removed)).toMatchObject({ ok: false, brokenAt: entries[2].id });
  });

  it('заглушка начинается с записей, и цепочка у них цела', () => {
    resetJournal({ withSeed: true });
    expect(journalEntries().length).toBeGreaterThan(0);
    expect(verifyJournal().ok).toBe(true);
  });
});
