import type { QueryClient } from '@tanstack/react-query';
import { toast } from '@/shared/lib/toast';
import { ApiError, errorMessageKey, knownErrorCodes } from './errors';

/**
 * Обработчики успеха и ошибок запросов — одно место для всего приложения.
 *
 * Мутация сама описывает, что сказать пользователю:
 *   useMutation({ mutationFn, meta: { successMessage: 'newTask.created' } })
 *   useMutation({ mutationFn, meta: { successMessage: (task) => ({ key: 'mailQueue.created',
 *     params: { code: task.code } }) } })
 *   meta: { errorMessage: false } — ошибку показывает сам экран (поле формы, баннер)
 *
 * Ошибка мутации по умолчанию — тост с понятным текстом (errors.*). Ошибка загрузки (query) —
 * без тоста: её показывает экран; тост — только если указан meta.errorMessage.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

/** Ключ перевода или ключ с параметрами */
export type MessageSpec = string | { key: string; params?: Record<string, unknown> };

export type FeedbackMeta = {
  /** Тост при успехе; функция получает результат мутации */
  successMessage?: MessageSpec | ((data: never) => MessageSpec);
  /** Свой текст ошибки вместо общего; false — без тоста */
  errorMessage?: MessageSpec | false;
};

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: FeedbackMeta;
    mutationMeta: FeedbackMeta;
  }
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

const resolve = (spec: MessageSpec, t: Translate) =>
  typeof spec === 'string' ? t(spec) : t(spec.key, spec.params);

/** Текст ошибки для пользователя (для форм и экранов, которые показывают ошибку сами) */
export const errorText = (error: unknown, t: Translate) =>
  t(errorMessageKey(error, knownErrorCodes));

/** Показать ошибку тостом. Номер запроса — мелко, чтобы его можно было передать поддержке */
export function notifyError(error: unknown, t: Translate, spec?: MessageSpec) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  toast.error({
    title: spec ? resolve(spec, t) : errorText(error, t),
    text: requestId ? t('errors.requestId', { id: requestId }) : undefined,
  });
}

export function notifySuccess(spec: MessageSpec, t: Translate) {
  toast.success(resolve(spec, t));
}

type Options = {
  t: Translate;
  /** Ключ запроса сессии: перечитываем её при 401 и 403 */
  sessionKey: readonly unknown[];
  getClient: () => QueryClient;
};

/**
 * Обработчики для QueryCache и MutationCache:
 * - 401 — сессия истекла: перечитываем сессию, экран входа откроется сам;
 * - 403 — права могли измениться: перечитываем сессию, интерфейс подстроится;
 * - остальное — тост по правилам выше.
 */
export function createFeedbackHandlers({ t, sessionKey, getClient }: Options) {
  const refreshSession = (error: unknown) => {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      getClient().invalidateQueries({ queryKey: sessionKey });
    }
  };
  // Неудача самого запроса сессии — это «не вошёл», а не ошибка для тоста
  const isSessionQuery = (key: readonly unknown[]) =>
    JSON.stringify(key) === JSON.stringify(sessionKey);

  return {
    onQueryError(error: unknown, query: { queryKey: readonly unknown[]; meta?: FeedbackMeta }) {
      if (isSessionQuery(query.queryKey)) return;
      refreshSession(error);
      const spec = query.meta?.errorMessage;
      if (spec) notifyError(error, t, spec);
    },
    onMutationError(error: unknown, meta?: FeedbackMeta) {
      refreshSession(error);
      if (meta?.errorMessage === false) return;
      // 401 — пользователя и так вернёт на вход; тост объяснит почему
      notifyError(error, t, meta?.errorMessage);
    },
    onMutationSuccess(data: unknown, meta?: FeedbackMeta) {
      const spec = meta?.successMessage;
      if (!spec) return;
      notifySuccess(typeof spec === 'function' ? spec(data as never) : spec, t);
    },
  };
}
