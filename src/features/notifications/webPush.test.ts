import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationsServer } from './testing/server';
import { disableWebPush, enableWebPush, syncWebPush, webPushState } from './webPush';

/** Браузер с service worker и Push API (в jsdom их нет — подставляем) */
function fakeBrowser(permission: NotificationPermission, decision = permission) {
  let subscription: PushSubscription | null = null;
  const unsubscribe = vi.fn(async () => {
    subscription = null;
    return true;
  });
  const make = (key: Uint8Array) =>
    ({
      endpoint: 'https://push.example/1',
      options: { applicationServerKey: key.buffer },
      unsubscribe,
      toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } }),
    }) as unknown as PushSubscription;
  const pushManager = {
    getSubscription: vi.fn(async () => subscription),
    subscribe: vi.fn(async ({ applicationServerKey }: { applicationServerKey: Uint8Array }) => {
      subscription = make(applicationServerKey);
      return subscription;
    }),
  };
  const reg = { pushManager };
  let registered = false;
  const serviceWorker = {
    getRegistration: vi.fn(async () => (registered ? reg : undefined)),
    register: vi.fn(async () => {
      registered = true;
      return reg;
    }),
    ready: Promise.resolve(reg),
  };
  const notification = {
    permission,
    requestPermission: vi.fn(async () => {
      notification.permission = decision;
      return decision;
    }),
  };
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', notification);
  Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true });
  return { pushManager, serviceWorker, notification, unsubscribe };
}

describe('браузерные уведомления', () => {
  beforeEach(() => {
    notificationsServer.webPush.enabled = true;
  });
  afterEach(() => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  it('jsdom без Push API — не поддерживается', async () => {
    expect(await webPushState()).toBe('unsupported');
    expect(await enableWebPush()).toBe('unsupported');
  });

  it('включение: разрешение, подписка, отдать бэкенду; выключение — отписка', async () => {
    const browser = fakeBrowser('default', 'granted');
    expect(await webPushState()).toBe('off');
    expect(await enableWebPush()).toBe('on');
    expect(browser.notification.requestPermission).toHaveBeenCalled();
    expect(browser.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    expect(notificationsServer.webPush.endpoints).toEqual(['https://push.example/1']);
    expect(await webPushState()).toBe('on');
    // Повторное включение не создаёт вторую подписку
    await enableWebPush();
    expect(browser.pushManager.subscribe).toHaveBeenCalledTimes(1);

    await disableWebPush();
    expect(browser.unsubscribe).toHaveBeenCalled();
    expect(notificationsServer.webPush.endpoints).toEqual([]);
    expect(await webPushState()).toBe('off');
  });

  it('ключ сервера сменился — подписка пересоздаётся', async () => {
    const browser = fakeBrowser('granted');
    await enableWebPush();
    notificationsServer.webPush.publicKey = 'BOtherKy';
    await enableWebPush();
    expect(browser.unsubscribe).toHaveBeenCalledTimes(1);
    expect(browser.pushManager.subscribe).toHaveBeenCalledTimes(2);
  });

  it('запрещено в браузере / не настроено на сервере', async () => {
    fakeBrowser('default', 'denied');
    expect(await enableWebPush()).toBe('denied');
    expect(await webPushState()).toBe('denied');
    notificationsServer.webPush.enabled = false;
    expect(await webPushState()).toBe('unavailable');
    expect(await enableWebPush()).toBe('unavailable');
  });

  it('при входе подписанный браузер напоминает о себе бэкенду', async () => {
    fakeBrowser('granted');
    await enableWebPush();
    notificationsServer.webPush.endpoints = [];
    await syncWebPush();
    expect(notificationsServer.webPush.endpoints).toEqual(['https://push.example/1']);
  });
});
