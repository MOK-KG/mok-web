import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { api } from '@/shared/api/client';
import { DownloadIcon } from '@/shared/ui/icons';
import { Markdown } from '@/shared/ui/Markdown';

/**
 * Просмотр файла .md (/view?src=…&name=…): браузер показал бы сырой текст, здесь — markdown.
 * Файл берётся только с API платформы (или из памяти вкладки — blob:), с cookie сессии:
 * права на файл проверяет бэкенд, как при скачивании.
 */
export function MarkdownViewer() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const src = params.get('src') ?? '';
  const name = params.get('name') ?? '';
  const allowed = isAllowedSource(src);
  const file = useQuery({
    queryKey: ['markdown-file', src],
    enabled: allowed,
    retry: false,
    queryFn: async () => {
      const response = await fetch(src, { credentials: 'include' });
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    },
  });
  usePageSubtitle(name || undefined);

  return (
    <article className="mx-auto w-full max-w-[860px] rounded-14 border border-line bg-panel px-8 py-6">
      <header className="mb-4 flex items-center gap-3 border-b border-line pb-3">
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">{name}</h1>
        {allowed && (
          <a
            href={src}
            download={name}
            className="flex h-8 items-center gap-[6px] rounded-9 border border-line px-3 text-[12px] text-sub hover:text-text"
          >
            <DownloadIcon size={14} />
            {t('files.download')}
          </a>
        )}
      </header>
      {!allowed ? (
        <p className="py-10 text-center text-[12.5px] text-dim">{t('files.viewerForbidden')}</p>
      ) : file.isError ? (
        <p role="alert" className="py-10 text-center text-[12.5px] text-dim">
          {t('files.viewerError')}
        </p>
      ) : file.data === undefined ? null : (
        <Markdown text={file.data} />
      )}
    </article>
  );
}

/** Только файлы платформы: адрес API (или /api того же сайта) и blob: этой вкладки */
export function isAllowedSource(src: string): boolean {
  if (!src) return false;
  if (src.startsWith('blob:')) return src.startsWith(`blob:${window.location.origin}`);
  const base = api.url('');
  const absolute = new URL(src, window.location.origin).href;
  const apiBase = new URL(base, window.location.origin).href;
  return absolute.startsWith(apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
}
