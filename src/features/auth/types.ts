import type { Permission, RoleCode } from '@/shared/config/permissions';

export type SessionUser = {
  email: string;
  name: string;
  /** Должность для подписи в меню: «Ген. секретарь» */
  position: string;
  /** Департамент для подписи в шапке */
  department: string;
  /** Роли — для отображения; доступ проверяется только по permissions */
  roles: RoleCode[];
  /** Права, рассчитанные бэкендом по ролям пользователя */
  permissions: Permission[];
};

/**
 * Сессия пользователя:
 * - active — роль назначена, доступ открыт;
 * - pending — вошёл через Google, но администратор ещё не назначил роль.
 */
export type Session = {
  status: 'active' | 'pending';
  user: SessionUser;
};

/** Ошибка входа, которую бэкенд возвращает в /login?error=...&email=... */
export type SignInError = { code: 'forbidden_domain'; email: string } | { code: 'unknown' };
