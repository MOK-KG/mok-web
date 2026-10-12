import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';
import i18n from './i18n';
import { AppProviders } from './providers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const render = () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <AppProviders>
        <HomePage />
      </AppProviders>,
    ),
  );
  return { container, unmount: () => act(() => root.unmount()) };
};

describe('HomePage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('переключает тему через data-theme', () => {
    const { container, unmount } = render();
    expect(document.documentElement.dataset.theme).toBe('dark');
    act(() => container.querySelector('button')?.click());
    expect(document.documentElement.dataset.theme).toBe('light');
    unmount();
  });

  it('меняет строку-пример при смене языка', async () => {
    const { container, unmount } = render();
    expect(container.textContent).toContain('Добро пожаловать');
    await act(() => i18n.changeLanguage('en'));
    expect(container.textContent).toContain('Welcome to the National Olympic Committee');
    await act(() => i18n.changeLanguage('ky'));
    expect(container.textContent).toContain('кош келиңиз');
    unmount();
  });
});
