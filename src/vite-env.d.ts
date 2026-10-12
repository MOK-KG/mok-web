/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Заглушка авторизации: active | pending | denied. Пусто — реальный бэкенд */
  readonly VITE_AUTH_MOCK?: string;
  /** Роль в заглушке авторизации: R1–R9 */
  readonly VITE_AUTH_MOCK_ROLE?: string;
}
