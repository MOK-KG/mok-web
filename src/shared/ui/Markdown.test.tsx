import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { markdownToBlocks } from '@/features/knowledge-base/markdown';
import { Markdown, wikiToLinks } from './Markdown';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

async function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
}

describe('Markdown', () => {
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('жирный, курсив, код, таблица, списки задач и блок кода', async () => {
    await render(
      <Markdown
        text={[
          '# Регламент',
          '',
          '**Важно:** срок — _5 дней_, код `ЗД-2026-0001`.',
          '',
          '| Кто | Что |',
          '| --- | --- |',
          '| Юрист | Аккредитация |',
          '',
          '- [x] сделано',
          '- [ ] осталось',
          '',
          '```',
          '# не заголовок',
          '```',
        ].join('\n')}
      />,
    );
    expect(container.querySelector('h2')?.textContent).toBe('Регламент');
    expect(container.querySelector('strong')?.textContent).toBe('Важно:');
    expect(container.querySelector('em')?.textContent).toBe('5 дней');
    expect(container.querySelector('p code')?.textContent).toBe('ЗД-2026-0001');
    expect(container.querySelectorAll('td')[0]?.textContent).toBe('Юрист');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(container.querySelector('pre')?.textContent).toContain('# не заголовок');
  });

  it('ссылки: внешние — в новой вкладке, slug.md и [[…]] — через resolveLink', async () => {
    const resolve = (target: string) => (target.startsWith('zony') ? '/knowledge/zony' : null);
    await render(
      <Markdown
        text="[сайт](https://olympic.kg) · [зоны](zony.md) · [[zony|Зоны]] · [[Нет такой]] · [в app](/tasks)"
        resolveLink={resolve}
      />,
    );
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['сайт', 'https://olympic.kg'],
      ['зоны', '/knowledge/zony'],
      ['Зоны', '/knowledge/zony'],
      ['в app', '/tasks'],
    ]);
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(container.textContent).toContain('Нет такой');
  });

  it('сырой HTML не выполняется; inline — без абзацев', async () => {
    await render(<Markdown text={'<img src=x onerror="alert(1)"> **ок**'} inline />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe('ок');
  });

  it('[[…]] внутри блока кода не превращается в ссылку', () => {
    expect(wikiToLinks('```\n[[a]]\n```\n[[b]]')).toBe('```\n[[a]]\n```\n[b](wiki:b)');
  });
});

describe('блоки статьи', () => {
  it('блок кода с пустыми строками и «#» — один абзац', () => {
    const blocks = markdownToBlocks('## Пример\n\n```\nfoo\n\n# bar\n```\n\nТекст после');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'paragraph']);
    expect(blocks[1]).toEqual({ kind: 'paragraph', text: '```\nfoo\n\n# bar\n```' });
  });
});
