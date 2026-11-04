import type { KbBlock } from './types';

/**
 * Текст статьи хранится на бэкенде в markdown (по нему строятся поиск и ссылки между статьями),
 * редактор и страница статьи работают с блоками. Соответствие:
 *
 * - заголовок — `## текст` (при чтении подходит любой уровень `#`–`######`);
 * - список — строки `- пункт` (при чтении — также `*`, `+` и `1.`);
 * - заметка — цитата: `> **Заголовок**` и строки `> текст`;
 * - абзац — всё остальное, строки внутри абзаца сохраняются.
 *
 * Якоря заголовков — `h-1`, `h-2`… по порядку: в markdown они не хранятся.
 */

const HEADING = /^#{1,6}\s+(.*)$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const NOTE_TITLE = /^\*\*(.+)\*\*$/;

export function blocksToMarkdown(blocks: KbBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading':
          return `## ${oneLine(b.text)}`;
        case 'list':
          return b.items.map((item) => `- ${oneLine(item)}`).join('\n');
        case 'note': {
          const lines = [
            ...(b.title.trim() ? [`**${oneLine(b.title)}**`] : []),
            ...b.text.split('\n'),
          ];
          return lines.map((line) => (line ? `> ${line}` : '>')).join('\n');
        }
        default:
          return b.text;
      }
    })
    .filter((chunk) => chunk.trim() !== '')
    .join('\n\n');
}

export function markdownToBlocks(markdown: string): KbBlock[] {
  const blocks: KbBlock[] = [];
  let headings = 0;
  for (const chunk of splitBlocks(markdown)) {
    const lines = chunk.split('\n');
    const heading = lines.length === 1 ? HEADING.exec(lines[0]) : null;
    if (heading) {
      headings += 1;
      blocks.push({ kind: 'heading', id: `h-${headings}`, text: heading[1].trim() });
    } else if (lines.every((l) => LIST_ITEM.test(l))) {
      blocks.push({ kind: 'list', items: lines.map((l) => (LIST_ITEM.exec(l)?.[1] ?? l).trim()) });
    } else if (lines.every((l) => QUOTE.test(l))) {
      const text = lines.map((l) => QUOTE.exec(l)?.[1] ?? '');
      const title = NOTE_TITLE.exec(text[0]?.trim() ?? '');
      blocks.push({
        kind: 'note',
        title: title ? title[1].trim() : '',
        text: (title ? text.slice(1) : text).join('\n').trim(),
      });
    } else {
      blocks.push({ kind: 'paragraph', text: chunk });
    }
  }
  return blocks;
}

const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ').trim();

/**
 * Блоки markdown: разделены пустой строкой; заголовок — всегда отдельный блок, даже если
 * сразу за ним идёт текст без пустой строки.
 */
function splitBlocks(markdown: string): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const text = current.join('\n').trim();
    if (text) chunks.push(text);
    current = [];
  };
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === '') flush();
    else if (HEADING.test(line)) {
      flush();
      current.push(line.trim());
      flush();
    } else current.push(line.trimEnd());
  }
  flush();
  return chunks;
}
