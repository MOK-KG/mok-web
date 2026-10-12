export type SessionUser = {
  email: string;
  name: string;
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
