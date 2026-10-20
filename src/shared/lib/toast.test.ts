import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_TOASTS, toast, useToasts } from './toast';

// Состояние хранилища читаем через хук — как это делает Toaster
let current: ReturnType<typeof useToasts> = [];
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  useSyncExternalStore: (_s: unknown, get: () => ReturnType<typeof useToasts>) => get(),
}));
const read = () => {
  current = useToasts();
  return current;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  toast.clear();
  vi.useRealTimers();
});

describe('тосты', () => {
  it('показывает и скрывает по времени; ошибки дольше', () => {
    toast.success('Задача создана');
    toast.error('Нет соединения');
    expect(read().map((t) => t.tone)).toEqual(['success', 'error']);
    vi.advanceTimersByTime(4000);
    expect(read().map((t) => t.title)).toEqual(['Нет соединения']);
    vi.advanceTimersByTime(2000);
    expect(read()).toEqual([]);
  });

  it('одинаковый текст не дублируется, а продлевается', () => {
    toast.error('Нет соединения');
    vi.advanceTimersByTime(5000);
    toast.error('Нет соединения');
    expect(read()).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(read()).toHaveLength(1);
  });

  it(`не больше ${MAX_TOASTS} разом — старые уходят`, () => {
    for (const n of [1, 2, 3, 4]) toast.info(`Сообщение ${n}`);
    expect(read().map((t) => t.title)).toEqual(['Сообщение 2', 'Сообщение 3', 'Сообщение 4']);
  });

  it('duration: 0 — пока не закроют', () => {
    const id = toast.warning({ title: 'Важно', duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(read()).toHaveLength(1);
    toast.dismiss(id);
    expect(read()).toEqual([]);
  });
});
