/**
 * HTTP-клиент. Типы API будут генерироваться из OpenAPI командой `pnpm api:sync`
 * в src/shared/api/schema.d.ts, когда появится бэкенд.
 */
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.status === 204 ? (undefined as T) : res.json();
}
