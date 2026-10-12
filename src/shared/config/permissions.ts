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
  'documents.register',
  'documents.resolve',
  'documents.annul',
  // База знаний
  'knowledge.view',
  'knowledge.edit',
  // Чат
  'chat.use',
  // Сотрудники и роли
  'staff.view',
  'staff.manage',
  'staff.deactivate',
  'roles.assign',
  // Журнал действий — только просмотр
  'journal.view',
] as const;

export type Permission = (typeof permissions)[number];

/** Разделы приложения и право, без которого раздел закрыт */
export const sections = {
  tasks: 'tasks.view',
  documents: 'documents.view',
  knowledge: 'knowledge.view',
  chat: 'chat.use',
  staff: 'staff.view',
  journal: 'journal.view',
} as const satisfies Record<string, Permission>;

export type Section = keyof typeof sections;

export const roleCodes = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'] as const;

export type RoleCode = (typeof roleCodes)[number];

const everyone: Permission[] = ['tasks.view', 'knowledge.view', 'chat.use'];

/**
 * ЗАГЛУШКА матрицы ролей — только для mock-режима, НЕ из ТЗ.
 * TODO: заменить матрицей из ТЗ (../docs/roli.md); настоящая матрица — на бэкенде.
 * Известно только: R6 — делопроизводство.
 */
export const mockRoleMatrix: Record<RoleCode, Permission[]> = {
  R1: [...permissions],
  R2: [...everyone, 'tasks.create', 'tasks.edit', 'tasks.assign', 'tasks.archive', 'staff.view'],
  R3: [...everyone, 'tasks.create', 'tasks.edit'],
  R4: [...everyone, 'tasks.create', 'tasks.edit'],
  R5: [...everyone, 'tasks.create', 'tasks.edit'],
  R6: [
    ...everyone,
    'tasks.create',
    'documents.view',
    'documents.register',
    'documents.resolve',
    'documents.annul',
  ],
  R7: [...everyone, 'knowledge.edit'],
  R8: [...everyone, 'staff.view', 'staff.manage', 'staff.deactivate', 'roles.assign'],
  R9: [...everyone],
};

export const isPermission = (value: unknown): value is Permission =>
  permissions.includes(value as Permission);
