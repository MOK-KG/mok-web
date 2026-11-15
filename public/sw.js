/*
 * Service worker платформы НОК КР: только браузерные уведомления (Web Push).
 * Бэкенд (apps/notifications/web_push.py) присылает {id, kind, title, body, url, tag};
 * клик открывает адрес в уже открытой вкладке платформы или в новой.
 * Ничего не кэширует — интерфейс всегда свежий.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'НОК КР';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      lang: 'ru',
      data: { url: data.url || '/notifications', id: data.id },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const own = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (own) {
        await own.focus();
        return own.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});
