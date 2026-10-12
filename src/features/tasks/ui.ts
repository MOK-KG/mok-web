import type { Tone } from '@/shared/config/tokens';
import type { TaskStatus } from './types';

/**
 * Классы оттенков. Записаны полностью, чтобы Tailwind их нашёл при сборке
 * (имена классов нельзя собирать из кусков строк).
 */
export const toneClasses: Record<Tone, { text: string; bg: string; dot: string }> = {
  blue: { text: 'text-tone-blue', bg: 'bg-tone-blue-bg', dot: 'bg-tone-blue' },
  amber: { text: 'text-tone-amber', bg: 'bg-tone-amber-bg', dot: 'bg-tone-amber' },
  red: { text: 'text-tone-red', bg: 'bg-tone-red-bg', dot: 'bg-tone-red' },
  purple: { text: 'text-tone-purple', bg: 'bg-tone-purple-bg', dot: 'bg-tone-purple' },
  green: { text: 'text-tone-green', bg: 'bg-tone-green-bg', dot: 'bg-tone-green' },
  violet: { text: 'text-tone-violet', bg: 'bg-tone-violet-bg', dot: 'bg-tone-violet' },
  orange: { text: 'text-tone-orange', bg: 'bg-tone-orange-bg', dot: 'bg-tone-orange' },
  gold: { text: 'text-tone-gold', bg: 'bg-tone-gold-bg', dot: 'bg-tone-gold' },
  cyan: { text: 'text-tone-cyan', bg: 'bg-tone-cyan-bg', dot: 'bg-tone-cyan' },
};

/** Цвет точки в заголовке колонки */
export const statusDot: Record<TaskStatus, string> = {
  queue: 'bg-faint',
  in_progress: 'bg-info',
  review: 'bg-warning',
  done: 'bg-success',
};

/** Сколько карточек видно в колонке до «Показать все» (как в макете) */
export const visibleByStatus: Record<TaskStatus, number> = {
  queue: 4,
  in_progress: 4,
  review: 4,
  done: 3,
};
