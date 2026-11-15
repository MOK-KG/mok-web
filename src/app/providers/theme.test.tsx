import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ThemeMode, ThemeProvider, useTheme } from './ThemeProvider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let current: ReturnType<typeof useTheme>;

function Probe() {
  current = useTheme();
  return null;
}

const systemPrefers = (scheme: 'light' | 'dark') =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes(scheme),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

async function mount() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    ),
  );
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('тема', () => {
  it('по умолчанию — как в системе: светлая система → светлая тема', async () => {
    systemPrefers('light');
    await mount();
    expect(current.mode).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('по умолчанию — как в системе: тёмная система → тёмная тема', async () => {
    systemPrefers('dark');
    await mount();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('выбор пользователя сохраняется', async () => {
    systemPrefers('dark');
    await mount();
    await act(async () => current.setMode('light' as ThemeMode));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('nok.theme')).toBe('light');
  });
});
