import { describe, expect, it } from 'vitest';
import { mockRoleMatrix, type Permission, type RoleCode } from '@/shared/config/permissions';
import { type AppNotification, canSeeNotification } from './api';

const note = (target: AppNotification['target'], kind: AppNotification['kind'] = 'reminder') =>
  ({ id: 'n', kind, title: '', text: '', at: '', read: false, target }) as AppNotification;

const canAs = (role: RoleCode) => (p: Permission) => mockRoleMatrix[role].includes(p);

describe('какие уведомления видны', () => {
  it('очередь из почты — только тем, кто создаёт задачи', () => {
    const queue = note({ kind: 'mailQueue' }, 'mailQueue');
    expect(canSeeNotification(queue, canAs('R3'))).toBe(true);
    expect(canSeeNotification(queue, canAs('R5'))).toBe(true);
    expect(canSeeNotification(queue, canAs('R9'))).toBe(false);
    expect(canSeeNotification(queue, canAs('R2'))).toBe(false);
  });

  it('задача — с доступом к задачам, чат — с чатом', () => {
    const task = note({ kind: 'task', taskTitle: 'X' });
    const chat = note({ kind: 'chat', chatId: 'c' }, 'mention');
    expect(canSeeNotification(task, canAs('R1'))).toBe(false);
    expect(canSeeNotification(task, canAs('R9'))).toBe(true);
    expect(canSeeNotification(chat, canAs('R9'))).toBe(false);
    expect(canSeeNotification(chat, canAs('R1'))).toBe(true);
  });
});
