import { useKnowledge } from './api';

/**
 * Ссылки из текста статьи — в статьи базы знаний, как их собирает бэкенд
 * (apps/knowledge/markdown.py): `[текст](slug.md)` и `[[slug]]` / `[[Название]]`.
 * Неизвестная или закрытая статья — без ссылки (просто текст).
 */
export function useArticleLinks() {
  const articles = useKnowledge().data?.articles ?? [];
  return (target: string): string | null => {
    const clean = decodeURI(target).split('#')[0].replace(/^\.\//, '');
    const slug = clean.replace(/\.md$/i, '').split('/').pop() ?? '';
    const needle = slug.toLowerCase();
    const found =
      articles.find((a) => a.id === slug) ??
      articles.find((a) => a.title.trim().toLowerCase() === clean.trim().toLowerCase()) ??
      articles.find((a) => a.id.toLowerCase() === needle);
    return found ? `/knowledge/${found.id}` : null;
  };
}
