import { docNumber } from './api';
import { type Letter, letterhead, letterRef, letterSubject, localNumber } from './letter';
import type { DocumentRecord } from './types';

/**
 * Письмо на бланке как самостоятельный HTML-документ: свои стили, логотип и подпись
 * встроены data-URI — ничего не грузится по ссылке, поэтому печать и пересылка файла
 * показывают логотип и подпись (приёмка 11.14). Тот же HTML — в предпросмотре.
 *
 * Цвета бумаги фиксированные (белый лист, тёмный текст) — от темы интерфейса не зависят.
 */

/** Логотип-ЗАГЛУШКА (знак приложения). Настоящий логотип НОК КР — из настроек бланка */
export const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0A1628"/><circle cx="16" cy="16" r="8" fill="none" stroke="#E8112D" stroke-width="3"/><circle cx="16" cy="16" r="3" fill="#F7C948"/></svg>';

/** Детерминированный «росчерк» из имени — факсимиле-ЗАГЛУШКА до загрузки настоящего */
export function signatureSvg(name: string): string {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h % 1000) / 1000;
  };
  let x = 8;
  let d = `M ${x} ${30 + rnd() * 10}`;
  for (let i = 0; i < 7; i++) {
    const nx = x + 14 + rnd() * 10;
    d += ` C ${x + 4} ${5 + rnd() * 10}, ${nx - 4} ${45 + rnd() * 10}, ${nx} ${22 + rnd() * 16}`;
    x = nx;
  }
  d += ` M 10 ${44 + rnd() * 4} Q ${x / 2} ${52 + rnd() * 6}, ${x + 6} ${40 + rnd() * 6}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 14} 60"><path d="${d}" fill="none" stroke="#1F3A8A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export const svgDataUri = (svg: string) =>
  `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

const esc = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replaceAll('\n', '<br>')}</p>`)
    .join('');

export type LetterView = {
  doc: Pick<DocumentRecord, 'kind' | 'seq' | 'year' | 'date' | 'title' | 'status' | 'fingerprint'>;
  letter: Letter;
  /** Кто подписывает; у проекта — будущий подписант */
  signer: string;
};

export function letterHtml({ doc, letter, signer }: LetterView): string {
  const h = letterhead[letter.lang];
  const number = docNumber(doc);
  const draft = doc.status === 'draft';
  const subject = letterSubject(doc.title, letter.lang);
  return `<!doctype html><html lang="${letter.lang}"><head><meta charset="utf-8"><title>${esc(
    number ?? doc.title,
  )}</title><style>
  @page { size: A4; margin: 18mm 20mm 20mm 25mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #FFFFFF; color: #0A1628; }
  body { font: 12pt/1.45 "Times New Roman", Times, serif; }
  .sheet { width: 210mm; min-height: 297mm; padding: 18mm 20mm 20mm 25mm; margin: 0 auto; position: relative; }
  @media print { .sheet { padding: 0; width: auto; min-height: auto; } }
  .head { display: flex; gap: 14px; align-items: center; border-bottom: 2px solid #E8112D; padding-bottom: 10px; }
  .head img { width: 48px; height: 48px; }
  .org { font-weight: bold; font-size: 13pt; line-height: 1.25; }
  .contacts { font-size: 9.5pt; color: #4A5568; margin-top: 2px; }
  .ref { margin-top: 14px; font-size: 10.5pt; color: #2D3748; }
  .to { margin: 22px 0 0 auto; width: 55%; white-space: pre-line; }
  .subject { margin-top: 22px; font-weight: bold; }
  .body { margin-top: 14px; text-align: justify; }
  .body p { margin: 0 0 10px; }
  .sign { margin-top: 28px; display: flex; align-items: flex-end; justify-content: space-between; }
  .sign .stamp { text-align: center; font-size: 8pt; color: #718096; }
  .sign .stamp img { height: 46px; display: block; margin: 0 auto -6px; }
  .foot { margin-top: 30px; font-size: 8pt; color: #718096; }
  .draft { position: absolute; top: 120mm; left: 0; right: 0; text-align: center; font-size: 64pt; color: rgba(232,17,45,0.10); transform: rotate(-24deg); font-weight: bold; letter-spacing: 8px; }
  </style></head><body><div class="sheet">
  ${draft ? `<div class="draft">${letter.lang === 'en' ? 'DRAFT' : letter.lang === 'ky' ? 'ДОЛБООР' : 'ПРОЕКТ'}</div>` : ''}
  <div class="head"><img alt="${esc(h.orgShort)}" src="${svgDataUri(LOGO_SVG)}"><div><div class="org">${esc(
    h.org,
  )}</div><div class="contacts">${esc(h.contacts)}</div></div></div>
  <div class="ref">${esc(letterRef(number, doc.date, letter.lang))}</div>
  <div class="to">${esc(letter.addressee)}</div>
  <div class="subject">${esc(subject)}</div>
  <div class="body">${paragraphs(letter.body)}</div>
  <div class="sign"><div>${esc(h.signerPosition)}<br>${esc(h.orgShort)}</div>
  ${
    draft
      ? '<div class="stamp">________________</div>'
      : `<div class="stamp"><img alt="" src="${svgDataUri(signatureSvg(signer))}">${esc(h.facsimile)}</div>`
  }
  <div>${esc(signer)}</div></div>
  ${doc.fingerprint ? `<div class="foot">${esc(number ? localNumber(number, letter.lang) : '')} · ${doc.fingerprint}</div>` : ''}
  </div></body></html>`;
}
