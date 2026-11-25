import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { bumpPhotoVersion } from '@/shared/lib/photoVersion';
import { PersonPhoto } from './PersonPhoto';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('фото профиля поверх инициалов', () => {
  it('нет фото — остаются инициалы; новое фото после загрузки подтягивается снова', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<PersonPhoto id="7" />));
    const img = () => container.querySelector('img');
    expect(img()?.getAttribute('src')).toContain('/staff/photos/7');
    await act(async () => img()?.dispatchEvent(new Event('error')));
    expect(img()).toBeNull();
    await act(async () => bumpPhotoVersion());
    expect(img()?.getAttribute('src')).toMatch(/\/staff\/photos\/7\?v=\d+/);
    await act(async () => root.render(<PersonPhoto id="u-mock" />));
    expect(img()).toBeNull();
    act(() => root.unmount());
  });
});
