import { beforeEach, describe, expect, it } from 'vitest';
import { journalServer } from '../journal/testing/server';
import { documentPool } from '../knowledge-base/testing/fixtures';
import { fetchBoard } from '../tasks/api';
import { people } from '../tasks/directory';
import { installTasksServer } from '../tasks/testing/server';
import {
  annul,
  awaitingResolution,
  createDraft,
  docNumber,
  docRef,
  fetchDocument,
  fetchDocuments,
  findByRef,
  issue,
  markDone,
  nextSeq,
  registerIncoming,
  resolve,
} from './api';
import { mockCounts } from './mock';
import { installDocumentsServer } from './testing/server';
import type { DocKind } from './types';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

beforeEach(() => {
  installTasksServer({ today: TODAY });
  installDocumentsServer({ today: TODAY });
});

const numbered = async (kind: DocKind) =>
  (await fetchDocuments())
    .filter((d) => d.kind === kind && d.seq !== null)
    .map((d) => d.seq as number)
    .sort((a, b) => a - b);

const registered = async () => {
  const doc = (await fetchDocuments()).find((d) => d.status === 'registered');
  if (!doc) throw new Error('нет входящего на резолюции');
  return doc;
};

describe('регистрационные номера', () => {
  it('сквозные и без пропусков по каждому виду', async () => {
    for (const kind of ['incoming', 'outgoing', 'order'] as const) {
      expect(await numbered(kind)).toEqual(
        Array.from({ length: mockCounts[kind] }, (_, i) => i + 1),
      );
    }
  });

  it('список: проекты сверху, затем новые; дата растёт вместе с номером', async () => {
    const docs = await fetchDocuments();
    expect(docs[0].seq).toBeNull();
    const incoming = docs
      .filter((d) => d.kind === 'incoming')
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    for (let i = 1; i < incoming.length; i++) {
      expect(incoming[i].date >= incoming[i - 1].date).toBe(true);
    }
  });

  it('формат как в Базе знаний; все документы из статей есть в делопроизводстве', async () => {
    const docs = await fetchDocuments();
    const refs = new Set(docs.map(docRef));
    expect(docNumber({ kind: 'incoming', seq: 884, year: 2026 })).toBe('Вх. №2026-0884');
    expect(docNumber({ kind: 'order', seq: 58, year: 2026 })).toBe('Приказ №58');
    for (const doc of documentPool) {
      expect(refs.has(doc.number), doc.number).toBe(true);
    }
    expect(findByRef('Вх. №2026-0884 · Минюст', docs)).toBe('doc-incoming-2026-884');
    expect(findByRef('Вх. №1999-0001 · Нет', docs)).toBeNull();
  });

  it('входящий получает следующий номер при регистрации, файлы — вложениями', async () => {
    const file = new File(['%PDF'], 'запрос.pdf', { type: 'application/pdf' });
    const doc = await registerIncoming({
      title: 'Тест',
      party: 'МОК',
      senderRef: '',
      summary: '',
      files: [file],
      category: 'request',
    });
    expect(doc.seq).toBe(mockCounts.incoming + 1);
    expect(doc.status).toBe('registered');
    expect(doc.replyDue).toBe('2026-09-23');
    expect(doc.attachments).toMatchObject([{ name: 'запрос.pdf', size: 4 }]);
    expect(doc.history.map((h) => h.kind)).toEqual(['registered']);
    expect(journalServer.entries.at(-1)).toMatchObject({ action: 'documentRegistered' });
  });

  it('у черновика номера нет; номер выдаётся при отправке', async () => {
    const draft = await createDraft({
      kind: 'outgoing',
      title: 'Письмо',
      party: 'Минспорт',
      summary: '',
    });
    expect(draft.seq).toBeNull();
    expect(draft.letter?.addressee).toBe('Минспорт');
    const sent = await issue(draft.id);
    expect(sent.seq).toBe(mockCounts.outgoing + 1);
    expect(sent.status).toBe('sent');
    expect(sent.signer?.id).toBe(people.ad.id);
    expect(sent.fingerprint).toBeTruthy();
    await expect(issue(draft.id)).rejects.toMatchObject({ status: 409, code: 'document_status' });
  });

  it('аннулированный номер остаётся занятым — следующий идёт дальше', async () => {
    const last = (await fetchDocuments()).find(
      (d) => d.kind === 'order' && d.seq === mockCounts.order,
    );
    if (!last) throw new Error('нет приказа');
    await annul(last.id, 'Подписан с ошибкой');
    expect(nextSeq(await fetchDocuments(), 'order', 2026)).toBe(mockCounts.order + 1);
    const annulled = await fetchDocument(last.id);
    expect(annulled.seq).toBe(mockCounts.order);
    expect(annulled.status).toBe('annulled');
    expect(annulled.annulment?.reason).toBe('Подписан с ошибкой');
    const signed = await issue(
      (await createDraft({ kind: 'order', title: 'Новый', party: null, summary: '' })).id,
    );
    expect(signed.seq).toBe(mockCounts.order + 1);
  });
});

describe('резолюция и исполнение', () => {
  it('резолюция создаёт задачу исполнителю и пишется в журнал', async () => {
    const before = (await fetchBoard()).counts.department;
    const doc = await registered();
    const waiting = awaitingResolution(await fetchDocuments());
    const resolved = await resolve(doc.id, {
      text: 'Подготовить ответ',
      assignee: people.dt,
      due: '2026-09-18',
    });
    expect(resolved.status).toBe('inWork');
    expect(resolved.resolution?.taskTitle).toBe(doc.title);
    expect(resolved.resolution?.taskCode).toMatch(/^ЗД-2026-/);
    const task = (await fetchBoard()).tasks.find((t) => t.id === resolved.resolution?.taskId);
    expect(task?.assignee?.id).toBe(people.dt.id);
    expect((await fetchBoard()).counts.department).toBe(before + 1);
    expect(awaitingResolution(await fetchDocuments())).toBe(waiting - 1);
    expect(journalServer.entries.some((e) => e.action === 'documentResolved')).toBe(true);
    expect((await markDone(doc.id)).status).toBe('done');
    expect(journalServer.entries.at(-1)).toMatchObject({ action: 'documentDone' });
  });

  it('резолюция без текста не принимается', async () => {
    const doc = await registered();
    await expect(
      resolve(doc.id, { text: ' ', assignee: people.dt, due: TODAY }),
    ).rejects.toMatchObject({ code: 'resolution_short' });
  });

  it('у резолюции из заглушки срок и ссылка — от задачи', async () => {
    const doc = await fetchDocument('doc-incoming-2026-884');
    expect(doc.resolution?.due).toBe('2026-09-18');
    expect(doc.resolution?.taskCode).toMatch(/^ЗД-/);
  });

  it('аннулировать можно только с причиной и только один раз', async () => {
    const doc = await registered();
    await expect(annul(doc.id, 'нет')).rejects.toMatchObject({ code: 'reason_required' });
    await annul(doc.id, 'Ошибочная регистрация');
    await expect(annul(doc.id, 'Ошибочная регистрация')).rejects.toMatchObject({
      status: 409,
    });
    expect(journalServer.entries.at(-1)).toMatchObject({ action: 'documentAnnulled' });
  });
});
