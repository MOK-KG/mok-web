import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { addJournalEntry } from '@/features/journal/store';
import { type Permission, type Section, sections } from '@/shared/config/permissions';
import { useSession } from './useSession';

/**
 * Проверка прав текущего пользователя. Права приходят в сессии с бэкенда,
 * поэтому смена роли применяется сразу после обновления сессии.
 */
export function useCan() {
  const session = useSession();
  const granted = new Set(session.data?.status === 'active' ? session.data.user.permissions : []);
  const isActive = session.data?.status === 'active';
  const can = (permission: Permission | null) =>
    permission === null ? isActive : granted.has(permission);
  return {
    can,
    canAny: (list: Permission[]) => list.some((p) => granted.has(p)),
    /** Открыт ли раздел меню */
    canOpen: (section: Section) => can(sections[section]),
  };
}

/** Показывает детей только при наличии права. Для кнопок и пунктов меню */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useCan();
  return can(permission) ? children : fallback;
}

/**
 * Охрана маршрута по праву. Без права — экран «Нет доступа» (403),
 * а не пустой список и не тихий редирект (блокирующая проверка приёмки).
 */
export function RequirePermission({
  permission,
  children,
}: {
  /** null — достаточно активной роли */
  permission: Permission | null;
  children: ReactNode;
}) {
  const { can } = useCan();
  const allowed = can(permission);
  useLogDenied(!allowed, permission);
  return allowed ? children : <ForbiddenPage />;
}

/** «Айбек Дуйшеев» → «А. Дуйшеев» */
const shortName = (name: string) => {
  const [first, ...rest] = name.split(' ');
  return rest.length ? `${first.charAt(0)}. ${rest.join(' ')}` : name;
};

/**
 * Отказ по прямой ссылке попадает в журнал действий (приёмка 11.1). В заглушке пишет
 * интерфейс; с бэкендом — сервер, на сам запрос к данным.
 */
function useLogDenied(denied: boolean, permission: Permission | null) {
  const user = useSession().data?.user;
  const path = useLocation().pathname;
  useEffect(() => {
    if (!denied || !user) return;
    addJournalEntry({
      author: shortName(user.name),
      action: 'accessDenied',
      details: `${path} · ${permission ?? 'role'}`,
    });
  }, [denied, user, path, permission]);
}

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <main className="flex h-full min-h-[60vh] items-center justify-center p-6">
      <section
        role="alert"
        className="w-full max-w-[420px] rounded-18 border border-line bg-panel p-8 text-center"
      >
        <p className="text-[13px] font-semibold tracking-[1.5px] text-danger">403</p>
        <h1 className="mt-3 text-[24px] font-bold tracking-[-0.5px] text-text">
          {t('forbidden.title')}
        </h1>
        <p className="mt-3 text-[14px] leading-[22px] text-sub">{t('forbidden.text')}</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-11 bg-surface px-4 py-2 font-medium text-text hover:opacity-90"
        >
          {t('forbidden.home')}
        </Link>
      </section>
    </main>
  );
}
