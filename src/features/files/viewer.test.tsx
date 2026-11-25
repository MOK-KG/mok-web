import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/app/i18n';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { mockSessionFor } from '@/features/auth/mock';
import { api } from '@/shared/api/client';
import { markdownViewerUrl } from '@/shared/lib/files';
import { isAllowedSource } from './MarkdownViewer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
const page = () => document.body.textContent ?? '';
const waitFor = async (check: () => boolean, timeout = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Не дождались: ${page().slice(-400)}`);
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
};

async function open(url: string) {
  vi.stubEnv('VITE_AUTH_MOCK', 'active');
  sessionStorage.clear();
  sessionStorage.setItem('nok.mockSession', JSON.stringify(mockSessionFor('active', 'R3')));
  await i18n.changeLanguage('ru');
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  );
}

describe('просмотр .md', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
  });

  it('файл с API платформы рисуется как markdown', async () => {
    const src = api.url('/chat/messages/5/file');
    const previous = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === src
          ? new Response('# План\n\n- **пункт** один', { status: 200 })
          : previous(input, init),
      ),
    );
    await open(markdownViewerUrl(src, 'План.md'));
    await waitFor(() => !!document.querySelector('article strong'));
    expect(document.querySelector('article h2')?.textContent).toBe('План');
    expect(document.querySelector('article li')?.textContent).toBe('пункт один');
    expect(document.querySelector(`a[href="${src}"]`)?.getAttribute('download')).toBe('План.md');
  });

  it('чужой адрес не загружается; ошибка — сообщение', async () => {
    expect(isAllowedSource('https://evil.example/x.md')).toBe(false);
    expect(isAllowedSource('')).toBe(false);
    expect(isAllowedSource(`blob:${window.location.origin}/abc`)).toBe(true);
    await open(markdownViewerUrl('https://evil.example/x.md', 'x.md'));
    await waitFor(() => page().includes('нельзя открыть'));

    act(() => root.unmount());
    container.remove();
    const src = api.url('/knowledge/attachments/1/download');
    const previous = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === src ? new Response('', { status: 403 }) : previous(input, init),
      ),
    );
    await open(markdownViewerUrl(src, 'x.md'));
    await waitFor(() => page().includes('Не удалось открыть файл'));
  });
});
