import { diffDays, type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import type { KbArticle, KbArticleSummary, KbBlock, KbFreshness } from './types';

/** Статья помечается «Актуально», если её обновили не раньше недели назад */
export const FRESH_DAYS = 7;
/** «Давно не обновляли» — с 30 дней без правок */
export const STALE_DAYS = 30;

/** С какой даты считать актуальность: последняя правка или проверка — что позже */
export const checkedAt = (a: Pick<KbArticleSummary, 'updatedAt' | 'reviewed'>): IsoDate =>
  a.reviewed && a.reviewed.date > a.updatedAt ? a.reviewed.date : a.updatedAt;

export function freshnessOf(updatedAt: IsoDate, today: IsoDate = todayInBishkek()): KbFreshness {
  const age = diffDays(updatedAt, today);
  if (age <= FRESH_DAYS) return 'fresh';
  if (age >= STALE_DAYS) return 'stale';
  return null;
}

const normalize = (text: string) => text.toLowerCase().replaceAll('ё', 'е');

/**
 * Слова запроса без окончаний: «документов» находит «документы» и «документа».
 * Короткие слова (до 5 букв) — целиком.
 */
export function queryStems(query: string): string[] {
  return normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((word) => (word.length > 5 ? word.slice(0, -2) : word));
}

const blockText = (block: KbBlock) => {
  switch (block.kind) {
    case 'list':
      return block.items.join(' ');
    case 'note':
      return `${block.title} ${block.text}`;
    default:
      return block.text;
  }
};

export const articleText = (a: Pick<KbArticle, 'title' | 'summary' | 'body'>) =>
  normalize([a.title, a.summary, ...a.body.map(blockText)].join(' '));

/** Статья подходит, если в ней есть все слова запроса. Пустой запрос — подходит любая */
export function matchesQuery(
  article: Pick<KbArticle, 'title' | 'summary' | 'body'>,
  query: string,
): boolean {
  const stems = queryStems(query);
  if (stems.length === 0) return true;
  const text = articleText(article);
  return stems.every((stem) => text.includes(stem));
}
