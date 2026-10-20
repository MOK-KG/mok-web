import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { toast } from '@/shared/lib/toast';
import { ApiError } from './errors';
import { createFeedbackHandlers } from './feedback';

const sessionKey = ['auth', 'session'] as const;

const setup = () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const shown: { tone: string; title: string; text?: string }[] = [];
  for (const tone of ['success', 'error'] as const) {
    vi.spyOn(toast, tone).mockImplementation((input) => {
      shown.push({ tone, ...(typeof input === 'string' ? { title: input } : input) });
      return 0;
    });
  }
  const handlers = createFeedbackHandlers({
    t: (key, params) => i18n.t(key, params),
    sessionKey,
    getClient: () => client,
  });
  return { handlers, invalidate, shown };
};

afterEach(() => vi.restoreAllMocks());

describe('обработчики успеха и ошибок', async () => {
  await i18n.changeLanguage('ru');

  it('ошибка мутации — тост с понятным текстом и номером запроса', () => {
    const { handlers, shown } = setup();
    handlers.onMutationError(new ApiError(500, 'Internal', { requestId: 'r-42' }));
    expect(shown).toEqual([
      {
        tone: 'error',
        title: 'Ошибка на сервере. Мы уже знаем — попробуйте позже.',
        text: 'Номер запроса: r-42',
      },
    ]);
  });

  it('код бэкенда даёт свой текст', () => {
    const { handlers, shown } = setup();
    handlers.onMutationError(new ApiError(409, '', { code: 'wip_limit' }));
    expect(shown[0].title).toBe('В колонке «В работе» уже максимум задач.');
  });

  it('errorMessage: false — экран показывает ошибку сам', () => {
    const { handlers, shown } = setup();
    handlers.onMutationError(new ApiError(422, ''), { errorMessage: false });
    expect(shown).toEqual([]);
  });

  it('успех — текст из meta, с параметрами из результата', () => {
    const { handlers, shown } = setup();
    handlers.onMutationSuccess(
      { code: 'ЗД-2026-0412' },
      { successMessage: (task: { code: string }) => ({ key: 'mailQueue.created', params: task }) },
    );
    expect(shown).toEqual([{ tone: 'success', title: 'Задача ЗД-2026-0412 создана' }]);
  });

  it('ошибка загрузки — без тоста, если экран не просил', () => {
    const { handlers, shown } = setup();
    handlers.onQueryError(new ApiError(500, ''), { queryKey: ['tasks'] });
    expect(shown).toEqual([]);
    handlers.onQueryError(new ApiError(500, ''), {
      queryKey: ['tasks'],
      meta: { errorMessage: 'errors.server' },
    });
    expect(shown).toHaveLength(1);
  });

  it('401 и 403 — перечитать сессию; сбой самого запроса сессии — не тост', () => {
    const { handlers, invalidate, shown } = setup();
    handlers.onQueryError(new ApiError(403, ''), { queryKey: ['tasks'] });
    handlers.onMutationError(new ApiError(401, ''));
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(shown.map((s) => s.title)).toEqual(['Сессия истекла — войдите снова.']);
    handlers.onQueryError(new ApiError(500, ''), {
      queryKey: sessionKey,
      meta: { errorMessage: 'x' },
    });
    expect(shown).toHaveLength(1);
  });
});
