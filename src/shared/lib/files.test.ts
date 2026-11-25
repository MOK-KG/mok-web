import { describe, expect, it } from 'vitest';
import { fileLinkProps } from '@/shared/ui/fileLink';
import { extensionOf, inlineUrl, isMarkdown, isPreviewable, markdownViewerUrl } from './files';

describe('просмотр файлов в браузере', () => {
  it('PDF, картинки, текст, аудио и видео открываются для просмотра', () => {
    expect(['akt.PDF', 'foto.jpg', 'note.txt', 'rec.mp4'].every(isPreviewable)).toBe(true);
    expect(['smeta.xlsx', 'page.html', 'logo.svg', 'README'].some(isPreviewable)).toBe(false);
    expect(extensionOf('archive.tar.gz')).toBe('gz');
  });

  it('ссылка: просматриваемое — в новой вкладке с inline=1, остальное — скачать', () => {
    expect(inlineUrl('/api/x/download')).toBe('/api/x/download?inline=1');
    expect(inlineUrl('/api/x?a=1')).toBe('/api/x?a=1&inline=1');
    expect(fileLinkProps('/f', 'akt.pdf')).toEqual({
      href: '/f?inline=1',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    expect(fileLinkProps('/f', 'smeta.xlsx')).toEqual({ href: '/f', download: 'smeta.xlsx' });
  });
});

describe('markdown-файлы', () => {
  it('.md открываются в просмотрщике платформы, а не сырым текстом', () => {
    expect(['README.md', 'notes.MARKDOWN'].every(isMarkdown)).toBe(true);
    expect(isMarkdown('a.txt')).toBe(false);
    expect(markdownViewerUrl('/api/f?x=1', 'План.md')).toBe(
      `/view?src=${encodeURIComponent('/api/f?x=1')}&name=${encodeURIComponent('План.md')}`.replace(
        /%20/g,
        '+',
      ),
    );
    expect(fileLinkProps('/api/f', 'plan.md')).toEqual({
      href: markdownViewerUrl('/api/f', 'plan.md'),
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });
});
