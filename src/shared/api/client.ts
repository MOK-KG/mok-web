/**
 * HTTP-клиент. Типы API будут генерироваться из OpenAPI командой `pnpm api:sync`
 * в src/shared/api/schema.d.ts, когда появится бэкенд.
 */
const baseUrl = import.meta.env.VITE_API_URL || '/api';

// Бесплатный ngrok без этого заголовка отвечает страницей-предупреждением вместо API
const tunnelHeaders: Record<string, string> = baseUrl.includes('.ngrok')
  ? { 'ngrok-skip-browser-warning': '1' }
  : {};

const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const apiUrl = (path: string) => `${baseUrl}${path}`;

/**
 * CSRF-токен Django для изменяющих запросов. Бэкенд может быть на другом домене, и cookie
 * csrftoken отсюда не прочитать — токен берём из /auth/csrf и кэшируем до ответа 403.
 */
let csrfToken: Promise<string> | null = null;

function getCsrfToken(): Promise<string> {
  csrfToken ??= request<{ csrfToken: string }>('/auth/csrf')
    .then((res) => res.csrfToken)
    .catch((error) => {
      csrfToken = null;
      throw error;
    });
  return csrfToken;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...tunnelHeaders, ...init?.headers },
    credentials: 'include',
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.status === 204 ? (undefined as T) : res.json();
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (safeMethods.includes(method)) return request<T>(path, init);

  const headers = { ...init?.headers, 'X-CSRFToken': await getCsrfToken() };
  try {
    return await request<T>(path, { ...init, headers });
  } catch (error) {
    // Токен меняется при входе и выходе — следующий запрос возьмёт свежий
    if (error instanceof ApiError && error.status === 403) csrfToken = null;
    throw error;
  }
}
