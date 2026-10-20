import { ApiError, parseErrorBody } from './errors';

/**
 * Базовый HTTP-клиент: JSON, параметры запроса, тайм-аут, разбор ошибок бэкенда.
 * Настройки платформы (адрес API, cookie или токен) — в shared/api/client.ts каждого приложения.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = Omit<RequestInit, 'body'> & {
  /** Объект уходит как JSON; FormData и строки — как есть */
  body?: unknown;
  query?: QueryParams;
  /** Тайм-аут в мс; по умолчанию — из настроек клиента */
  timeoutMs?: number;
};

export type ApiClientConfig = {
  baseUrl: string;
  /** Заголовки каждого запроса, например Authorization с токеном сессии */
  headers?: () => Record<string, string>;
  /** web: 'include' — cookie сессии */
  credentials?: RequestCredentials;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;

function buildQuery(query?: QueryParams) {
  if (!query) return '';
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `?${params.join('&')}` : '';
}

const isRawBody = (body: unknown) =>
  typeof body === 'string' ||
  (typeof FormData !== 'undefined' && body instanceof FormData) ||
  (typeof Blob !== 'undefined' && body instanceof Blob);

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createApiClient(config: ApiClientConfig) {
  const url = (path: string, query?: QueryParams) => `${config.baseUrl}${path}${buildQuery(query)}`;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body, query, timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS, ...init } = options;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    // Отмена снаружи (TanStack Query передаёт signal) тоже прерывает запрос
    init.signal?.addEventListener('abort', () => controller.abort());

    const raw = body !== undefined && isRawBody(body);
    let res: Response;
    try {
      res = await fetch(url(path, query), {
        ...init,
        credentials: config.credentials,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
          ...config.headers?.(),
          ...(init.headers as Record<string, string> | undefined),
        },
        body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
      });
    } catch (error) {
      // Отмену снаружи не превращаем в ошибку сети: запрос просто больше не нужен
      if (init.signal?.aborted) throw error;
      throw new ApiError(0, timedOut ? 'Timeout' : 'Network error', {
        code: timedOut ? 'timeout' : 'network',
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await readBody(res);
    if (!res.ok) {
      const parsed = parseErrorBody(data);
      throw new ApiError(res.status, parsed.message ?? res.statusText, parsed);
    }
    return data as T;
  }

  const withBody =
    (method: string) =>
    <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>(path, { ...options, method, body });

  return {
    url,
    request,
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: withBody('POST'),
    put: withBody('PUT'),
    patch: withBody('PATCH'),
    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { ...options, method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
