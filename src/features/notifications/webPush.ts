import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/**
 * Браузерные уведомления (Web Push). Браузер подписывается через service worker
 * (public/sw.js) ключом VAPID с бэкенда и отдаёт подписку бэкенду
 * (/api/notifications/web-push); уведомления приходят, даже если вкладка закрыта.
 * Подписка привязана к сессии: «Выйти» или завершение сессии в профиле её снимает.
 */

export type WebPushState =
  /** Браузер не умеет (нет service worker / Push API, или не https) */
  | 'unsupported'
  /** На сервере не заданы ключи VAPID */
  | 'unavailable'
  /** Пользователь запретил уведомления в браузере — включить можно только в настройках сайта */
  | 'denied'
  | 'off'
  | 'on';

type Config = { enabled: boolean; publicKey: string };

const SW_URL = '/sw.js';

export const isWebPushSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** applicationServerKey: base64url → байты */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const fetchConfig = () => api.get<Config>('/notifications/web-push');

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  return existing ?? navigator.serviceWorker.register(SW_URL);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function webPushState(): Promise<WebPushState> {
  if (!isWebPushSupported()) return 'unsupported';
  const config = await fetchConfig();
  if (!config.enabled) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

const send = (subscription: PushSubscription) =>
  api.post<void>('/notifications/web-push', subscription.toJSON());

/** Включить: спросить разрешение, подписать браузер, отдать подписку бэкенду */
export async function enableWebPush(): Promise<WebPushState> {
  if (!isWebPushSupported()) return 'unsupported';
  const config = await fetchConfig();
  if (!config.enabled) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (subscription) {
    // Ключ сервера сменился — старая подписка не примет уведомления
    const old = subscription.options.applicationServerKey;
    const fresh = keyBytes(config.publicKey);
    const same =
      old &&
      new Uint8Array(old).length === fresh.length &&
      new Uint8Array(old).every((b, i) => b === fresh[i]);
    if (!same) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  subscription ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(config.publicKey),
  });
  await send(subscription);
  return 'on';
}

/** Выключить в этом браузере (и при выходе) */
export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await api.delete<void>('/notifications/web-push', { body: { endpoint } }).catch(() => null);
}

/**
 * При входе: браузер уже подписан — напомнить бэкенду (подписка привязана к сессии,
 * после смены сессии бэкенд её не знает). Ошибки молча: уведомления — не главное.
 */
export async function syncWebPush(): Promise<void> {
  try {
    if (!isWebPushSupported() || Notification.permission !== 'granted') return;
    const subscription = await currentSubscription();
    if (subscription && (await fetchConfig()).enabled) await send(subscription);
  } catch {
    // не мешаем работе
  }
}

const key = ['notifications', 'webPush'] as const;

export function useWebPush() {
  const client = useQueryClient();
  const state = useQuery({ queryKey: key, queryFn: webPushState, staleTime: 60_000 });
  const toggle = useMutation({
    mutationFn: async (on: boolean): Promise<WebPushState> => {
      if (on) return enableWebPush();
      await disableWebPush();
      return 'off';
    },
    onSuccess: (next) => client.setQueryData(key, next),
    meta: { errorMessage: 'notifications.browser.error' },
  });
  return { state: state.data, isLoading: state.isLoading, toggle };
}
