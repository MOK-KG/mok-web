import { inlineUrl, isPreviewable } from '@/shared/lib/files';

export function fileLinkProps(url: string, name: string) {
  return isPreviewable(name)
    ? { href: inlineUrl(url), target: '_blank', rel: 'noopener noreferrer' }
    : { href: url, download: name };
}
