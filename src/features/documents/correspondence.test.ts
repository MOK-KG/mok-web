import { beforeEach, describe, expect, it } from 'vitest';
import { journalEntries, resetJournal } from '../journal/store';
import { createDraft, docNumber, fetchDocuments, issue, resend, resetDocumentsMock } from './api';
import { correspondenceLog, deliver, reconcile, replyState } from './correspondence';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

beforeEach(() => {
  resetDocumentsMock(TODAY);
  resetJournal();
});

const byNumber = (n: string) => fetchDocuments().find((d) => docNumber(d) === n);

describe('доставка по почте (заглушка)', () => {
  it('известный домен — доставлено, неизвестный или неверный адрес — недоставка', () => {
    expect(deliver('info@minjust.gov.kg')).toEqual({ status: 'delivered', error: null });
    expect(deliver('x@judo-kgz.org')).toMatchObject({ status: 'bounced' });
    expect(deliver('x@judo-kgz.org').error).toContain('не найден');
    expect(deliver('без собаки')).toMatchObject({ status: 'bounced' });
  });
});

describe('журнал корреспонденции', () => {
  it('недоставка — отдельной срочной строкой сверху (приёмка 11.13)', () => {
    const rows = correspondenceLog(fetchDocuments(), TODAY);
    expect(rows[0]).toMatchObject({ urgent: true });
    expect(docNumber(rows[0].doc)).toBe('Исх. №2026-0411');
    expect(rows.filter((r) => r.urgent)).toHaveLength(1);
    // В журнале только входящие и исходящие с номером
    expect(rows.every((r) => r.doc.kind !== 'order' && r.doc.seq !== null)).toBe(true);
  });

  it('отправка на неизвестный домен: строка сверху, запись в журнале действий', () => {
    const d = createDraft(
      {
        kind: 'outgoing',
        title: 'О турнире',
        party: 'Федерация',
        summary: '',
        attachments: [],
        email: 'office@no-such-federation.kg-x',
      },
      TODAY,
    );
    const sent = issue(d.id, TODAY);
    expect(sent.delivery).toMatchObject({ status: 'bounced', attempts: 1 });
    expect(journalEntries().at(-1)).toMatchObject({ action: 'documentBounced' });
    const urgent = correspondenceLog(fetchDocuments(), TODAY).filter((r) => r.urgent);
    expect(urgent.map((r) => r.doc.id)).toContain(d.id);
  });

  it('повторная отправка — тот же номер, доставлено', () => {
    const bounced = byNumber('Исх. №2026-0411');
    if (!bounced) throw new Error('нет письма');
    const again = resend(bounced.id, 'secretary@judo.kg.gov.kg');
    expect(again.seq).toBe(bounced.seq);
    expect(again.fingerprint).toBe(bounced.fingerprint);
    expect(again.delivery).toMatchObject({ status: 'delivered', attempts: 2 });
    expect(correspondenceLog(fetchDocuments(), TODAY).some((r) => r.urgent)).toBe(false);
  });

  it('связки и ответы: «в ответ на» и состояние ответа', () => {
    const docs = fetchDocuments();
    const oks = byNumber('Вх. №2026-0894');
    const minjust = byNumber('Вх. №2026-0884');
    const sport = byNumber('Вх. №2026-0893');
    if (!oks || !minjust || !sport) throw new Error('нет входящих');
    // Ответ ОКС уже отправлен (Исх. №2026-0413)
    expect(replyState(oks, docs, TODAY)).toBe('answered');
    // Минюсту — проект ответа
    expect(replyState(minjust, docs, TODAY)).toBe('drafted');
    // Минспорт: срок 10 рабочих дней от регистрации, ответа нет
    expect(['waiting', 'soon', 'overdue']).toContain(replyState(sport, docs, TODAY));
    const row = correspondenceLog(docs, TODAY).find((r) => r.doc.id === oks.id);
    expect(row?.linked.map((l) => docNumber(l))).toEqual(['Исх. №2026-0413']);
  });

  it('сверка: отправлено = доставлено + не доставлено', () => {
    const r = reconcile(fetchDocuments(), TODAY);
    expect(r.emailed).toBe(r.delivered + r.bounced);
    expect(r.bounced).toBe(1);
  });
});
