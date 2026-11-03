import { beforeEach, describe, expect, it } from 'vitest';
import { chatMembers, fetchChatFiles, resetChatMock } from '../chat/api';
import { fetchDocuments, resetDocumentsMock } from '../documents/api';
import { fetchKnowledgeFiles } from '../knowledge-base/api';
import { collectFiles, fileTypeOf, filterFiles, formatSize, splitName } from './collect';

// Среда, 9 сентября 2026 — «сегодня» в макете
const TODAY = '2026-09-09';

beforeEach(() => {
  resetDocumentsMock(TODAY);
  resetChatMock();
});

const all = () =>
  collectFiles({
    documents: fetchDocuments(),
    knowledge: fetchKnowledgeFiles(['R1']),
    chat: fetchChatFiles(),
    memberName: (id) => chatMembers[id]?.short ?? null,
  });

describe('файлы из разделов', () => {
  it('все вложения документов, статей и переписок — по одному разу', () => {
    const items = all();
    const fromDocs = fetchDocuments().reduce((n, d) => n + d.attachments.length, 0);
    expect(items.filter((f) => f.source === 'documents')).toHaveLength(fromDocs);
    expect(items.filter((f) => f.source === 'knowledge')).toHaveLength(
      fetchKnowledgeFiles(['R1']).length,
    );
    expect(items.filter((f) => f.source === 'chat')).toHaveLength(3);
    expect(new Set(items.map((f) => f.id)).size).toBe(items.length);
  });

  it('новые сверху', () => {
    const items = all();
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].at >= items[i].at).toBe(true);
    }
  });

  it('раздел без права не передаётся — его файлов нет', () => {
    const items = collectFiles({ knowledge: fetchKnowledgeFiles(['R1']) });
    expect(items.every((f) => f.source === 'knowledge')).toBe(true);
  });

  it('у документа — номер и тема, ссылка на карточку', () => {
    const file = all().find((f) => f.name === 'запрос_минюст');
    expect(file).toMatchObject({
      ext: 'pdf',
      type: 'pdf',
      place: 'Вх. №2026-0884 · О предоставлении перевода устава',
      target: { kind: 'document', id: 'doc-incoming-2026-884', docKind: 'incoming' },
      addedBy: 'К. Асанов',
    });
  });

  it('у файла из чата — автор сообщения и переписка', () => {
    const file = all().find((f) => f.ext === 'xlsx' && f.source === 'chat');
    expect(file).toMatchObject({ place: 'Медицинский', addedBy: 'М. Эсенова' });
  });

  it('поиск по имени, месту и автору; фильтры по разделу и типу', () => {
    const items = all();
    expect(
      filterFiles(items, { source: null, type: null, query: 'минюст' }).length,
    ).toBeGreaterThan(0);
    const pdfs = filterFiles(items, { source: null, type: 'pdf', query: '' });
    expect(pdfs.every((f) => f.ext === 'pdf')).toBe(true);
    const chat = filterFiles(items, { source: 'chat', type: null, query: 'Эсенова' });
    expect(chat.map((f) => f.place)).toEqual(['Медицинский']);
  });
});

describe('имя и размер', () => {
  it('расширение и тип', () => {
    expect(splitName('form_q3.xlsx')).toEqual({ name: 'form_q3', ext: 'xlsx' });
    expect(splitName('README')).toEqual({ name: 'README', ext: '' });
    expect(fileTypeOf('DOCX')).toBe('doc');
    expect(fileTypeOf('zip')).toBe('other');
  });

  it('размер', () => {
    const units = { kb: 'КБ', mb: 'МБ' };
    expect(formatSize(null, units)).toBeNull();
    expect(formatSize(300, units)).toBe('1 КБ');
    expect(formatSize(48 * 1024, units)).toBe('48 КБ');
    expect(formatSize(2.5 * 1024 * 1024, units)).toBe('2.5 МБ');
    expect(formatSize(3 * 1024 * 1024, units)).toBe('3 МБ');
  });
});
