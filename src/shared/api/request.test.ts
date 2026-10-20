import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, errorMessageKey, knownErrorCodes, parseErrorBody } from './errors';
import { createApiClient } from './request';

const api = createApiClient({ baseUrl: 'https://api.test', headers: () => ({ 'X-Test': '1' }) });

const respond = (status: number, body?: unknown) =>
  vi
    .fn()
    .mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('базовый запрос', () => {
  it('JSON в теле, параметры в адресе, заголовки клиента', async () => {
    const fetch = respond(200, { id: 't-1' });
    vi.stubGlobal('fetch', fetch);
    const data = await api.post<{ id: string }>(
      '/tasks',
      { title: 'Отчёт' },
      {
        query: { tab: 'mine', page: 2, empty: undefined },
      },
    );
    expect(data).toEqual({ id: 't-1' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test/tasks?tab=mine&page=2');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"title":"Отчёт"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-Test': '1' });
  });

  it('204 — без тела', async () => {
    vi.stubGlobal('fetch', respond(204));
    await expect(api.delete('/notifications/n1')).resolves.toBeUndefined();
  });

  it('ошибка бэкенда: статус, код, поля и номер запроса', async () => {
    vi.stubGlobal(
      'fetch',
      respond(422, {
        code: 'validation',
        message: 'Bad',
        fields: { title: 'Короткое' },
        requestId: 'r-9',
      }),
    );
    const error = await api.get<never>('/tasks').catch((e: ApiError) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'validation', requestId: 'r-9' });
    expect(error.fields).toEqual({ title: 'Короткое' });
  });

  it('нет сети — ApiError со статусом 0 и кодом network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = await api.get<never>('/tasks').catch((e: ApiError) => e);
    expect(error.isNetwork).toBe(true);
    expect(errorMessageKey(error)).toBe('errors.network');
  });

  it('тайм-аут — ApiError с кодом timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('', 'AbortError')),
            ),
          ),
      ),
    );
    const pending = api.get<never>('/slow', { timeoutMs: 1000 }).catch((e: ApiError) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const error = await pending;
    expect(error.isTimeout).toBe(true);
  });

  it('отмена снаружи — не ошибка сети', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) =>
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('', 'AbortError')),
            ),
          ),
      ),
    );
    const controller = new AbortController();
    const pending = api
      .get<never>('/tasks', { signal: controller.signal })
      .catch((e: ApiError) => e);
    controller.abort();
    expect(await pending).not.toBeInstanceOf(ApiError);
  });
});

describe('текст ошибки', () => {
  it('по коду бэкенда, затем по статусу, затем общий', () => {
    const codes = knownErrorCodes;
    expect(errorMessageKey(new ApiError(409, '', { code: 'wip_limit' }), codes)).toBe(
      'errors.code.wip_limit',
    );
    expect(errorMessageKey(new ApiError(409, '', { code: 'other' }), codes)).toBe(
      'errors.conflict',
    );
    expect(errorMessageKey(new ApiError(403, ''))).toBe('errors.forbidden');
    expect(errorMessageKey(new ApiError(503, ''))).toBe('errors.server');
    expect(errorMessageKey(new ApiError(418, ''))).toBe('errors.unknown');
    expect(errorMessageKey(new Error('boom'))).toBe('errors.unknown');
  });

  it('тело FastAPI { detail } и мусор', () => {
    expect(parseErrorBody({ detail: 'Not found' }).message).toBe('Not found');
    expect(parseErrorBody('<html>')).toEqual({});
    expect(parseErrorBody({ fields: { a: 'x', b: 1 } }).fields).toEqual({ a: 'x' });
  });
});
