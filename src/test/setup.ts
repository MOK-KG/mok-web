import { afterEach, beforeEach, vi } from 'vitest';
import { installAbsencesServer } from '@/features/absences/testing/server';
import { installAssistantServer } from '@/features/assistant/testing/server';
import { installChatServer } from '@/features/chat/testing/server';
import { installDocumentsServer } from '@/features/documents/testing/server';
import { installJournalServer } from '@/features/journal/testing/server';
import { installNotificationsServer } from '@/features/notifications/testing/server';
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});
