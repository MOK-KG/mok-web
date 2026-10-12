import type { Person, Project } from './types';

/**
 * ЗАГЛУШКА справочников (до бэкенда): сотрудники и проекты из макета.
 * Имена вымышленные (см. CLAUDE.md, раздел «Данные»).
 */

export const people = {
  ad: { id: 'u-ad', name: 'Айбек Дуйшеев', short: 'А. Дуйшеев', tone: 'blue' },
  nb: { id: 'u-nb', name: 'Нурлан Бакиров', short: 'Н. Бакиров', tone: 'red' },
  dt: { id: 'u-dt', name: 'Дамира Токтосунова', short: 'Д. Токтосунова', tone: 'purple' },
  ka: { id: 'u-ka', name: 'Канат Асанов', short: 'К. Асанов', tone: 'amber' },
  me: { id: 'u-me', name: 'Мээрим Эсенова', short: 'М. Эсенова', tone: 'green' },
  // В макете — «Ю. Ведущий юрист» (должность вместо имени); берём вымышленное имя
  ju: { id: 'u-ju', name: 'Юлиана Ведерникова', short: 'Ю. Ведерникова', tone: 'violet' },
} satisfies Record<string, Person>;

/** Текущий пользователь заглушки — Айбек Дуйшеев */
export const currentUserId = people.ad.id;

export const projects = {
  antidoping: { id: 'p-antidoping', name: 'Антидопинг 2026', tone: 'green' },
  accreditation: { id: 'p-accreditation', name: 'Аккредитация', tone: 'violet' },
  legal: { id: 'p-legal', name: 'Правовая база 2026', tone: 'gold' },
  asian: { id: 'p-asian', name: 'Азиатские игры 2026', tone: 'blue' },
  international: { id: 'p-international', name: 'Международные связи', tone: 'orange' },
  partners: { id: 'p-partners', name: 'Партнёры и спонсоры', tone: 'purple' },
  grants: { id: 'p-grants', name: 'Гранты и заявки', tone: 'cyan' },
} satisfies Record<string, Project>;
