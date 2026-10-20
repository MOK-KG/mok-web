import { ApiError } from './errors';
import { createApiClient, type RequestOptions } from './request';

export { ApiError } from './errors';

/**
 * HTTP-клиент web: сессия — в cookie (credentials: include).
 * Типы API будут генерироваться из OpenAPI командой `pnpm api:sync`
 * в src/shared/api/schema.d.ts, когда появится бэкенд.
 */
const baseUrl = import.meta.env.VITE_API_URL || '/api';

// Бесплатный ngrok без этого заголовка отвечает страницей-предупреждением вместо API
const tunnelHeaders: Record<string, string> = baseUrl.includes('.ngrok')
  ? { 'ngrok-skip-browser-warning': '1' }
  : {};

const base = createApiClient({
  baseUrl,
  credentials: 'include',
  headers: () => tunnelHeaders,
});

const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

/**
 * CSRF-токен Django для изменяющих запросов. Бэкенд может быть на другом домене, и cookie
 * csrftoken отсюда не прочитать — токен берём из /auth/csrf и кэшируем до ответа 403.
 */
let csrfToken: Promise<string> | null = null;

function getCsrfToken(): Promise<string> {
  csrfToken ??= base
    .get<{ csrfToken: string }>('/auth/csrf')
    .then((res) => res.csrfToken)
    .catch((error) => {
      csrfToken = null;
      throw error;
    });
  return csrfToken;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  if (safeMethods.includes(method)) return base.request<T>(path, options);

  const headers = {
    ...(options.headers as Record<string, string> | undefined),
    'X-CSRFToken': await getCsrfToken(),
  };
  try {
    return await base.request<T>(path, { ...options, headers });
  } catch (error) {
    // Токен меняется при входе и выходе — следующий запрос возьмёт свежий
    if (error instanceof ApiError && error.status === 403) csrfToken = null;
    throw error;
  }
}

const withBody =
  (method: string) =>
  <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method, body });

export const api = {
  url: base.url,
  request,
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: withBody('POST'),
  put: withBody('PUT'),
  patch: withBody('PATCH'),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
