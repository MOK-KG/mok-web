import { createApiClient } from './request';

/**
 * HTTP-клиент web: сессия — в cookie (credentials: include).
 * Типы API будут генерироваться из OpenAPI командой `pnpm api:sync`
 * в src/shared/api/schema.d.ts, когда появится бэкенд.
 */
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  credentials: 'include',
});

export { ApiError } from './errors';
