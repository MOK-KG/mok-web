import { useSyncExternalStore } from 'react';

/**
 * Всплывающие сообщения (тосты): «Задача создана», «Нет соединения».
 * Небольшое хранилище вне React, чтобы показывать тост откуда угодно — из обработчиков
 * запросов, мутаций, форм. Отрисовывает их <Toaster /> своей платформы.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export type ToastInput = {
  /** Готовый (уже переведённый) текст */
  title: string;
  text?: string;
  /** Кнопка в тосте, например «Открыть» или «Повторить» */
  action?: { label: string; onPress: () => void };
  /** Сколько показывать, мс; 0 — пока не закроют */
  duration?: number;
};

export type Toast = ToastInput & { id: number; tone: ToastTone; duration: number };

/** Ошибки висят дольше: их нужно успеть прочитать */
const DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 6000,
};

/** Больше трёх тостов разом не читается — старые уходят */
export const MAX_TOASTS = 3;

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const emit = () => {
  for (const l of listeners) l();
};

export function dismissToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

function show(tone: ToastTone, input: ToastInput | string): number {
  const toast = typeof input === 'string' ? { title: input } : input;
  // Тот же текст уже на экране (например, десять запросов упали без сети) — не дублируем,
  // а продлеваем показ
  const same = toasts.find(
    (t) => t.tone === tone && t.title === toast.title && t.text === toast.text,
  );
  const duration = toast.duration ?? DURATION[tone];
  if (same) {
    schedule(same.id, duration);
    return same.id;
  }
  const id = ++seq;
  toasts = [...toasts, { ...toast, id, tone, duration }].slice(-MAX_TOASTS);
  // Вытесненные старые тосты — их таймеры больше не нужны
  for (const [shown, timer] of timers) {
    if (!toasts.some((t) => t.id === shown)) {
      clearTimeout(timer);
      timers.delete(shown);
    }
  }
  schedule(id, duration);
  emit();
  return id;
}

function schedule(id: number, duration: number) {
  clearTimeout(timers.get(id));
  if (duration > 0)
    timers.set(
      id,
      setTimeout(() => dismissToast(id), duration),
    );
}

export const toast = {
  success: (input: ToastInput | string) => show('success', input),
  error: (input: ToastInput | string) => show('error', input),
  info: (input: ToastInput | string) => show('info', input),
  warning: (input: ToastInput | string) => show('warning', input),
  dismiss: dismissToast,
  /** Убрать все — например, при выходе из аккаунта */
  clear() {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    toasts = [];
    emit();
  },
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Текущие тосты — для <Toaster /> */
export function useToasts(): Toast[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
}
