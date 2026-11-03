import { beforeEach, describe, expect, it } from 'vitest';
import { documentPool } from '../knowledge-base/mock';
import { journalEntries, resetTasksMock, tabCounts } from '../tasks/api';
import { people } from '../tasks/directory';
import {
  annul,
  awaitingResolution,
  createDraft,
  docNumber,
  docRef,
  fetchDocuments,
  issue,
  markDone,
  nextSeq,
  registerIncoming,
  resetDocumentsMock,
  resolve,
} from './api';
import { mockCounts } from './mock';
import type { DocKind } from './types';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

beforeEach(() => {
  resetTasksMock();
  resetDocumentsMock(TODAY);
});

const numbered = (kind: DocKind) =>
  fetchDocuments()
    .filter((d) => d.kind === kind && d.seq !== null)
    .map((d) => d.seq as number)
    .sort((a, b) => a - b);

describe('регистрационные номера', () => {
  it('сквозные и без пропусков по каждому виду', () => {
    for (const kind of ['incoming', 'outgoing', 'order'] as const) {
      const seqs = numbered(kind);
      expect(seqs).toEqual(Array.from({ length: mockCounts[kind] }, (_, i) => i + 1));
    }
  });

  it('дата растёт вместе с номером', () => {
    const incoming = fetchDocuments()
      .filter((d) => d.kind === 'incoming')
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    for (let i = 1; i < incoming.length; i++) {
      expect(incoming[i].date >= incoming[i - 1].date).toBe(true);
    }
  });

  it('формат как в Базе знаний; все документы из статей есть в делопроизводстве', () => {
    const refs = new Set(fetchDocuments().map(docRef));
    expect(docNumber({ kind: 'incoming', seq: 884, year: 2026 })).toBe('Вх. №2026-0884');
    expect(docNumber({ kind: 'order', seq: 58, year: 2026 })).toBe('Приказ №58');
    for (const doc of documentPool) {
      expect(refs.has(doc.number), doc.number).toBe(true);
    }
  });

  it('входящий получает следующий номер при регистрации', () => {
    const doc = registerIncoming(
      { title: 'Тест', party: 'МОК', senderRef: '', summary: '', attachments: [] },
      TODAY,
    );
    expect(doc.seq).toBe(mockCounts.incoming + 1);
    expect(doc.status).toBe('registered');
  });

  it('у черновика номера нет; номер выдаётся при отправке', () => {
    const draft = createDraft(
      { kind: 'outgoing', title: 'Письмо', party: 'Минспорт', summary: '', attachments: [] },
      TODAY,
    );
    expect(draft.seq).toBeNull();
    const sent = issue(draft.id, TODAY);
    expect(sent.seq).toBe(mockCounts.outgoing + 1);
    expect(sent.status).toBe('sent');
    expect(() => issue(draft.id, TODAY)).toThrow('wrong-status');
  });

  it('аннулированный номер остаётся занятым — следующий идёт дальше', () => {
    const docs = fetchDocuments();
    const last = docs.find((d) => d.kind === 'order' && d.seq === mockCounts.order);
    if (!last) throw new Error('нет приказа');
    annul(last.id, 'Подписан с ошибкой');
    expect(nextSeq(fetchDocuments(), 'order', 2026)).toBe(mockCounts.order + 1);
    const annulled = fetchDocuments().find((d) => d.id === last.id);
    expect(annulled?.seq).toBe(mockCounts.order);
    expect(annulled?.status).toBe('annulled');
  });
});

describe('резолюция и исполнение', () => {
  it('резолюция создаёт задачу исполнителю и пишется в журнал', async () => {
    const before = tabCounts().department;
    const doc = fetchDocuments().find((d) => d.status === 'registered');
    if (!doc) throw new Error('нет входящего на резолюции');
    const waiting = awaitingResolution(fetchDocuments());
    const resolved = await resolve(doc.id, {
      text: 'Подготовить ответ',
      assignee: people.dt,
      due: '2026-09-18',
    });
    expect(resolved.status).toBe('inWork');
    expect(resolved.resolution?.taskTitle).toBe(doc.title);
    expect(tabCounts().department).toBe(before + 1);
    expect(awaitingResolution(fetchDocuments())).toBe(waiting - 1);
    expect(journalEntries().some((e) => e.action === 'documentResolved')).toBe(true);
    expect(markDone(doc.id).status).toBe('done');
  });

  it('резолюция без текста не принимается', async () => {
    const doc = fetchDocuments().find((d) => d.status === 'registered');
    if (!doc) throw new Error('нет входящего');
    await expect(resolve(doc.id, { text: ' ', assignee: people.dt, due: TODAY })).rejects.toThrow(
      'text-required',
    );
  });

  it('у резолюции из заглушки срок совпадает со сроком задачи', () => {
    const doc = fetchDocuments().find((d) => d.seq === 884 && d.kind === 'incoming');
    expect(doc?.resolution?.due).toBe('2026-09-18');
  });

  it('аннулировать можно только с причиной и только один раз', () => {
    const doc = fetchDocuments().find((d) => d.status === 'registered');
    if (!doc) throw new Error('нет входящего');
    expect(() => annul(doc.id, 'нет')).toThrow('reason-required');
    annul(doc.id, 'Ошибочная регистрация');
    expect(() => annul(doc.id, 'Ошибочная регистрация')).toThrow('wrong-status');
  });
});
