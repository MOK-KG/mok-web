import { beforeEach, describe, expect, it } from 'vitest';
import { journalServer } from '../journal/testing/server';
import { createDraft, docNumber, fetchDocuments, issue, resend } from './api';
import { correspondenceLog, deliver, reconcile, replyState } from './correspondence';
import { installDocumentsServer } from './testing/server';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

beforeEach(() => {
  installDocumentsServer({ today: TODAY });
});

const byNumber = async (n: string) => (await fetchDocuments()).find((d) => docNumber(d) === n);

describe('доставка по почте (заглушка)', () => {
  it('известный домен — доставлено, неизвестный или неверный адрес — недоставка', () => {
    expect(deliver('info@minjust.gov.kg')).toEqual({ status: 'delivered', error: null });
    expect(deliver('x@judo-kgz.org')).toMatchObject({ status: 'bounced' });
    expect(deliver('x@judo-kgz.org').error).toContain('не найден');
    expect(deliver('без собаки')).toMatchObject({ status: 'bounced' });
  });
});

describe('журнал корреспонденции', () => {
  it('недоставка — отдельной срочной строкой сверху (приёмка 11.13)', async () => {
    const rows = correspondenceLog(await fetchDocuments(), TODAY);
    expect(rows[0]).toMatchObject({ urgent: true });
    expect(docNumber(rows[0].doc)).toBe('Исх. №2026-0411');
    expect(rows.filter((r) => r.urgent)).toHaveLength(1);
    // В журнале только входящие и исходящие с номером
    expect(rows.every((r) => r.doc.kind !== 'order' && r.doc.seq !== null)).toBe(true);
  });

  it('отправка на неизвестный домен: строка сверху, запись в журнале действий', async () => {
    const d = await createDraft({
      kind: 'outgoing',
      title: 'О турнире',
      party: 'Федерация',
      summary: '',
      email: 'office@no-such-federation.kgx',
    });
    const sent = await issue(d.id);
    expect(sent.delivery).toMatchObject({ status: 'bounced', attempts: 1 });
    expect(journalServer.entries.at(-1)).toMatchObject({ action: 'documentBounced' });
    const urgent = correspondenceLog(await fetchDocuments(), TODAY).filter((r) => r.urgent);
    expect(urgent.map((r) => r.doc.id)).toContain(d.id);
  });

  it('повторная отправка — тот же номер, доставлено', async () => {
    const bounced = await byNumber('Исх. №2026-0411');
    if (!bounced) throw new Error('нет письма');
    await expect(resend(bounced.id, 'нет')).rejects.toMatchObject({ code: 'email_invalid' });
    const again = await resend(bounced.id, 'secretary@judo.kg.gov.kg');
    expect(again.seq).toBe(bounced.seq);
    expect(again.fingerprint).toBe(bounced.fingerprint);
    expect(again.delivery).toMatchObject({ status: 'delivered', attempts: 2 });
    expect(again.history[0]).toMatchObject({ kind: 'resent', text: 'secretary@judo.kg.gov.kg' });
    expect(correspondenceLog(await fetchDocuments(), TODAY).some((r) => r.urgent)).toBe(false);
  });

  it('связки и ответы: «в ответ на» и состояние ответа', async () => {
    const docs = await fetchDocuments();
    const find = (n: string) => docs.find((d) => docNumber(d) === n);
    const oks = find('Вх. №2026-0894');
    const minjust = find('Вх. №2026-0884');
    const sport = find('Вх. №2026-0893');
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

  it('сверка: отправлено = доставлено + не доставлено', async () => {
    const r = reconcile(await fetchDocuments(), TODAY);
    expect(r.emailed).toBe(r.delivered + r.bounced);
    expect(r.bounced).toBe(1);
  });
});
