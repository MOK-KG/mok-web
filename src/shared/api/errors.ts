/**
 * Ошибки API и их тексты для пользователя.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

/** Ошибки без ответа сервера: нет сети или истекло время ожидания */
export type TransportErrorCode = 'network' | 'timeout';

export type ApiErrorDetails = {
  /** Машинный код ошибки от бэкенда, например «wip_limit» */
  code?: string;
  /** Ошибки по полям формы: имя поля → текст */
  fields?: Record<string, string>;
  /** Идентификатор запроса — по нему ошибку находят в логах бэкенда */
  requestId?: string;
};

export class ApiError extends Error {
  /** HTTP-статус; 0 — ответа не было (см. code: network или timeout) */
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;
  readonly requestId?: string;

  constructor(status: number, message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = details.code;
    this.fields = details.fields;
    this.requestId = details.requestId;
  }

  get isNetwork() {
    return this.status === 0 && this.code === 'network';
  }

  get isTimeout() {
    return this.status === 0 && this.code === 'timeout';
  }
}

const statusKeys: Record<number, string> = {
  400: 'errors.badRequest',
  401: 'errors.sessionExpired',
  403: 'errors.forbidden',
  404: 'errors.notFound',
  409: 'errors.conflict',
  413: 'errors.tooLarge',
  422: 'errors.validation',
  429: 'errors.rateLimited',
};

/**
 * Ключ перевода для ошибки. Сначала — известный код бэкенда (errors.code.*),
 * затем — статус, затем — общий текст. Подробности (стек, тело ответа) пользователю не показываем.
 */
export function errorMessageKey(error: unknown, knownCodes: readonly string[] = []): string {
  if (!(error instanceof ApiError)) return 'errors.unknown';
  if (error.isNetwork) return 'errors.network';
  if (error.isTimeout) return 'errors.timeout';
  if (error.code && knownCodes.includes(error.code)) return `errors.code.${error.code}`;
  if (statusKeys[error.status]) return statusKeys[error.status];
  if (error.status >= 500) return 'errors.server';
  return 'errors.unknown';
}

/** Коды бэкенда, для которых есть свой текст в errors.code.* */
export const knownErrorCodes = ['wip_limit', 'deadline_not_working_day'] as const;

/**
 * Тело ответа с ошибкой. Ожидаемый формат (уточнится с OpenAPI):
 * { code, message, fields: { title: '...' }, requestId } или FastAPI { detail }.
 */
export function parseErrorBody(body: unknown): ApiErrorDetails & { message?: string } {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const fields =
    b.fields && typeof b.fields === 'object'
      ? Object.fromEntries(
          Object.entries(b.fields as Record<string, unknown>).filter(
            (e): e is [string, string] => typeof e[1] === 'string',
          ),
        )
      : undefined;
  return {
    code: str(b.code),
    message: str(b.message) ?? str(b.detail),
    fields,
    requestId: str(b.requestId) ?? str(b.request_id),
  };
}
