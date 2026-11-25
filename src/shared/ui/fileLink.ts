import { inlineUrl, isMarkdown, isPreviewable, markdownViewerUrl } from '@/shared/lib/files';

export function fileLinkProps(url: string, name: string) {
  if (isMarkdown(name)) {
    return { href: markdownViewerUrl(url, name), target: '_blank', rel: 'noopener noreferrer' };
  }
  return isPreviewable(name)
    ? { href: inlineUrl(url), target: '_blank', rel: 'noopener noreferrer' }
    : { href: url, download: name };
}
