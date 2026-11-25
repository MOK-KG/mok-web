import { afterEach, beforeEach, vi } from 'vitest';

// Граф базы знаний рисуется на canvas — в jsdom его нет; заглушка показывает узлы кнопками
vi.mock('react-force-graph-2d', () => import('./forceGraphMock'));

import { installAbsencesServer } from '@/features/absences/testing/server';
import { installAssistantServer } from '@/features/assistant/testing/server';
import { installCalendarServer } from '@/features/calendar/testing/server';
import { installChatServer } from '@/features/chat/testing/server';
import { installDocumentsServer } from '@/features/documents/testing/server';
import { installJournalServer } from '@/features/journal/testing/server';
import { installNotificationsServer } from '@/features/notifications/testing/server';
import { installSessionsServer } from '@/features/profile/testing/server';
import { installStaffServer } from '@/features/roles/testing/server';
import { installTasksServer } from '@/features/tasks/testing/server';

/**
 * Перед каждым тестом — свежий подставной бэкенд задач (данные заглушки mock.ts):
 * раздел «Задачи» и разделы, которые показывают задачи (дашборд, календарь, поиск…),
 * работают через настоящий клиент API.
 */
beforeEach(() => {
  installTasksServer();
  // Журнал действий: пишет и бэкенд задач (письма), и разделы на заглушках (addJournalEntry)
  installJournalServer();
  // Отсутствия (и заместители в задачах) и «Роли и доступ»
  installAbsencesServer();
  installStaffServer();
  // Делопроизводство (после задач: резолюция создаёт задачу в сервере задач)
  installDocumentsServer();
  // Чат: каналы, личные переписки, автоответ (берёт отсутствия у сервера выше)
  installChatServer();
  // Уведомления (после задач: цели-задачи берут id у сервера задач)
  installNotificationsServer();
  // Настройки ИИ и агент почты
  installAssistantServer();
  // События календаря и личный Google Календарь
  installCalendarServer();
  // Активные сессии (профиль)
  installSessionsServer();
});

afterEach(() => {
  vi.unstubAllGlobals();
});
