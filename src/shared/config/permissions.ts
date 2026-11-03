/**
 * Права доступа.
 *
 * Файл продублирован в web/ и mobile/ (src/shared/config/permissions.ts) — правьте оба.
 *
 * Интерфейс проверяет ПРАВА, а не роли: бэкенд отдаёт в сессии список прав пользователя,
 * матрица «роль → права» живёт на бэкенде. Здесь — словарь прав и заглушка матрицы
 * для работы без бэкенда (mock).
 *
 * Правила удаления из ТЗ (../docs/model-dannyh.md) выражены отсутствием прав:
 * - журнал действий нельзя удалить или изменить — есть только journal.view;
 * - сотрудника нельзя удалить — только деактивировать (staff.deactivate);
 * - задачу нельзя удалить — только закрыть или архивировать (tasks.archive);
 * - документ нельзя удалить — только аннулировать (documents.annul), номер остаётся занятым.
 */

export const permissions = [
  // Задачи
  'tasks.view',
  'tasks.create',
  'tasks.edit',
  'tasks.assign',
  'tasks.archive',
  // Делопроизводство
  'documents.view',
  // Проект исходящего или приказа — без номера
  'documents.create',
  // Регистрация входящих и выдача номеров при отправке — журнал корреспонденции
  'documents.register',
  'documents.resolve',
  'documents.annul',
  // База знаний
  'knowledge.view',
  'knowledge.edit',
  // Чат
  'chat.use',
  // Календарь и файлы
  'calendar.view',
  'files.view',
  // Сотрудники и роли
  'staff.view',
  'staff.manage',
  'staff.deactivate',
  'roles.assign',
  // Журнал действий — просмотр и выгрузка для проверки; изменять и удалять нельзя
  'journal.view',
  'journal.export',
] as const;

export type Permission = (typeof permissions)[number];

/**
 * Разделы бокового меню в порядке макета и право, без которого раздел закрыт.
 * null — раздел доступен любому пользователю с ролью.
 * Журнал действий — внутри «Ролей и доступа» (право journal.view).
 */
export const sections = {
  dashboard: null,
  tasks: 'tasks.view',
  calendar: 'calendar.view',
  chat: 'chat.use',
  knowledge: 'knowledge.view',
  documents: 'documents.view',
  files: 'files.view',
  access: 'staff.view',
} as const satisfies Record<string, Permission | null>;

export type Section = keyof typeof sections;

export const roleCodes = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'] as const;

export type RoleCode = (typeof roleCodes)[number];

/** У всех сотрудников аппарата */
const staffBase: Permission[] = ['chat.use', 'calendar.view', 'files.view'];

/** Работа с задачами без назначения и архивирования */
const taskWork: Permission[] = ['tasks.view', 'tasks.create', 'tasks.edit'];

/**
 * ЗАГЛУШКА матрицы ролей для mock-режима; настоящая — на бэкенде.
 * Собрана по разделу 06 ТЗ этапа 1 (../docs/roli.md). Матрицы «роль × действие» в ТЗ нет —
 * она в макете (стр. 16); где ТЗ не уточняет, решение помечено в roli.md как допущение.
 */
export const mockRoleMatrix: Record<RoleCode, Permission[]> = {
  // Администратор: пользователи, роли, справочники, настройки, аудит. Без кадровых данных
  R1: [
    ...staffBase,
    'staff.view',
    'staff.manage',
    'staff.deactivate',
    'roles.assign',
    'journal.view',
  ],
  // Президент: чтение задач, базы знаний, делопроизводства
  R2: [...staffBase, 'tasks.view', 'knowledge.view', 'documents.view'],
  // Генеральный секретарь: полный доступ; единственный, кому доступна выгрузка журнала
  R3: [...permissions],
  // Директор департамента: полные права в своём департаменте — задачи, база знаний, документы
  R4: [
    ...staffBase,
    ...taskWork,
    'tasks.assign',
    'tasks.archive',
    'knowledge.view',
    'knowledge.edit',
    'documents.view',
    'documents.create',
    'documents.resolve',
    'staff.view',
  ],
  // Сотрудник департамента: свои задачи и департамента, общая база знаний, создание документов
  R5: [...staffBase, ...taskWork, 'knowledge.view', 'documents.view', 'documents.create'],
  // Делопроизводство: полные права на журнал корреспонденции и регистрационные номера
  R6: [
    ...staffBase,
    ...taskWork,
    'knowledge.view',
    'documents.view',
    'documents.create',
    'documents.register',
    'documents.annul',
  ],
  // Финансы: задачи, база знаний, чтение делопроизводства (финансы — этап 2)
  R7: [...staffBase, ...taskWork, 'knowledge.view', 'documents.view'],
  // Юрист: то же (договоры — этап 2)
  R8: [...staffBase, ...taskWork, 'knowledge.view', 'documents.view'],
  // Наблюдатель: только чтение согласованного набора разделов (Исполком, Ревизионная комиссия)
  R9: ['tasks.view', 'knowledge.view', 'documents.view', 'calendar.view', 'files.view'],
};

export const isPermission = (value: unknown): value is Permission =>
  permissions.includes(value as Permission);
