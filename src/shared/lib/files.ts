const PREVIEW_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'txt',
  'mp3',
  'm4a',
  'ogg',
  'wav',
  'mp4',
  'webm',
]);

export const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

export const isPreviewable = (name: string) => PREVIEW_EXTENSIONS.has(extensionOf(name));

export const inlineUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}inline=1`;

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown']);

/** Markdown открывается не браузером (он покажет сырой текст), а просмотрщиком платформы */
export const isMarkdown = (name: string) => MARKDOWN_EXTENSIONS.has(extensionOf(name));

export const markdownViewerUrl = (src: string, name: string) =>
  `/view?${new URLSearchParams({ src, name })}`;
