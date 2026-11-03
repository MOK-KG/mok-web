import { beforeEach, describe, expect, it } from 'vitest';
import { createDraft, fetchDocuments, issue, resetDocumentsMock, updateLetter } from './api';
import {
  fillTemplate,
  letterDate,
  letterFingerprint,
  letterRef,
  letterSubject,
  localNumber,
  switchLang,
} from './letter';
import { letterHtml } from './letterHtml';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

beforeEach(() => resetDocumentsMock(TODAY));

const draft = () =>
  createDraft(
    { kind: 'outgoing', title: 'О календаре', party: 'Минспорт', summary: '', attachments: [] },
    TODAY,
  );

describe('письмо на бланке', () => {
  it('новый исходящий — с письмом по шаблону на русском', () => {
    const d = draft();
    expect(d.letter).toMatchObject({ lang: 'ru', templateId: 'standard', addressee: 'Минспорт' });
    expect(d.letter?.body).toContain('Уважаемый коллега!');
  });

  it('проект можно править; после отправки — нельзя, есть отпечаток', () => {
    const d = draft();
    if (!d.letter) throw new Error('нет письма');
    const edited = updateLetter(d.id, { ...d.letter, body: 'Новый текст' });
    expect(edited.letter?.body).toBe('Новый текст');
    expect(edited.history[0].kind).toBe('edited');
    const sent = issue(d.id, TODAY);
    expect(sent.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(() => updateLetter(d.id, { ...d.letter, body: 'Подмена' } as never)).toThrow(
      'immutable',
    );
  });

  it('отпечаток меняется от любой правки содержания', () => {
    const base = {
      number: 'Исх. №2026-0414',
      date: TODAY,
      title: 'О календаре',
      signer: 'А. Дуйшеев',
      letter: {
        lang: 'ru' as const,
        templateId: 'standard' as const,
        addressee: 'Минспорт',
        body: 'Текст',
      },
    };
    const a = letterFingerprint(base);
    expect(letterFingerprint({ ...base })).toBe(a);
    expect(letterFingerprint({ ...base, letter: { ...base.letter, body: 'Текст.' } })).not.toBe(a);
    expect(letterFingerprint({ ...base, number: 'Исх. №2026-0415' })).not.toBe(a);
  });

  it('у отправленных исходящих из заглушки есть письмо и отпечаток', () => {
    const sent = fetchDocuments().filter((d) => d.kind === 'outgoing' && d.status === 'sent');
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((d) => d.letter && d.fingerprint)).toBe(true);
  });

  it('логотип и подпись встроены в файл, а не по ссылке (приёмка 11.14)', () => {
    const d = draft();
    if (!d.letter) throw new Error('нет письма');
    const sent = issue(d.id, TODAY);
    const html = letterHtml({ doc: sent, letter: sent.letter ?? d.letter, signer: 'А. Дуйшеев' });
    const sources = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    expect(sources).toHaveLength(2);
    expect(sources.every((src) => src.startsWith('data:image/svg+xml;base64,'))).toBe(true);
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).toContain('Исх. №2026-0414 от 9 сентября 2026 г.');
    expect(html).not.toContain('ПРОЕКТ');
  });

  it('у проекта — пометка «проект», без номера и без факсимиле', () => {
    const d = draft();
    if (!d.letter) throw new Error('нет письма');
    const html = letterHtml({ doc: d, letter: d.letter, signer: 'А. Дуйшеев' });
    expect(html).toContain('ПРОЕКТ');
    expect([...html.matchAll(/<img/g)]).toHaveLength(1);
  });
});

describe('дата и номер на языке письма', () => {
  it('ru, ky, en', () => {
    expect(letterDate('2026-11-03', 'ru')).toBe('3 ноября 2026 г.');
    expect(letterDate('2026-11-03', 'ky')).toBe('2026-жылдын 3-ноябры');
    expect(letterDate('2026-11-03', 'en')).toBe('3 November 2026');
    expect(letterRef('Исх. №2026-0414', '2026-11-03', 'en')).toBe(
      'Ref. No.2026-0414 of 3 November 2026',
    );
  });
});

describe('язык и тема письма', () => {
  it('смена языка не стирает написанный текст', () => {
    const base = { lang: 'ru' as const, templateId: 'standard' as const, addressee: '' };
    const untouched = switchLang({ ...base, body: fillTemplate('standard', 'ru') }, 'en');
    expect(untouched.body).toBe(fillTemplate('standard', 'en'));
    const written = switchLang({ ...base, body: 'Свой текст' }, 'en');
    expect(written).toMatchObject({ lang: 'en', body: 'Свой текст' });
  });

  it('тема — как ввели; у английского — «Re:», номер — на языке бланка', () => {
    expect(letterSubject('О календаре', 'ru')).toBe('О календаре');
    expect(letterSubject('Calendar', 'en')).toBe('Re: Calendar');
    expect(localNumber('Исх. №2026-0414', 'en')).toBe('Ref. No.2026-0414');
  });
});
