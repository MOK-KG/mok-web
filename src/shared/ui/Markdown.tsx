import type { ReactNode } from 'react';
import ReactMarkdown, { type Components, defaultUrlTransform } from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

/**
 * Markdown (GFM: таблицы, списки задач, зачёркивание) — для статей базы знаний, файлов .md
 * и ответов ассистента. Сырой HTML не выполняется (react-markdown его экранирует).
 *
 * Ссылки: «/путь» — внутри приложения, http(s) и mailto — в новой вкладке; остальное
 * (`slug.md`, `[[Название]]`) передаётся в resolveLink — например, в статью базы знаний.
 * inline — без абзацев и блоков: для пункта списка, заголовка, подписи.
 */

export type ResolveLink = (target: string) => string | null;

const WIKI = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const FENCE = /^\s*(```|~~~)/;

/** [[цель|текст]] → [текст](wiki:цель); внутри блоков кода не трогаем */
export function wikiToLinks(text: string): string {
  let inCode = false;
  return text
    .split('\n')
    .map((line) => {
      if (FENCE.test(line)) inCode = !inCode;
      if (inCode) return line;
      return line.replace(
        WIKI,
        (_, target: string, label?: string) =>
          `[${(label ?? target).trim()}](wiki:${encodeURIComponent(target.trim())})`,
      );
    })
    .join('\n');
}

const urlTransform = (url: string) => (url.startsWith('wiki:') ? url : defaultUrlTransform(url));

const linkClass = 'break-words text-info underline underline-offset-2 hover:opacity-80';

function MdLink({
  href = '',
  children,
  resolveLink,
}: {
  href?: string;
  children: ReactNode;
  resolveLink?: ResolveLink;
}) {
  if (/^(https?:|mailto:)/i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {children}
      </a>
    );
  }
  if (href.startsWith('#')) {
    return (
      <a href={href} className={linkClass}>
        {children}
      </a>
    );
  }
  const target = href.startsWith('wiki:') ? decodeURIComponent(href.slice(5)) : href;
  const to = href.startsWith('/') ? href : (resolveLink?.(target) ?? null);
  if (!to) return <span className="text-text">{children}</span>;
  return (
    <Link to={to} className={linkClass}>
      {children}
    </Link>
  );
}

function components(
  resolveLink?: ResolveLink,
  size: 'article' | 'compact' = 'article',
): Components {
  const text = size === 'article' ? 'text-[13px] leading-[22px]' : 'text-[13px] leading-[19px]';
  return {
    a: ({ href, children }) => (
      <MdLink href={href} resolveLink={resolveLink}>
        {children}
      </MdLink>
    ),
    p: ({ children }) => (
      <p className={`${text} text-sub [&:not(:first-child)]:mt-2`}>{children}</p>
    ),
    h1: ({ children }) => (
      <h2 className="mt-4 text-[17px] font-semibold text-text first:mt-0">{children}</h2>
    ),
    h2: ({ children }) => (
      <h3 className="mt-4 text-[15px] font-semibold text-text first:mt-0">{children}</h3>
    ),
    h3: ({ children }) => (
      <h4 className="mt-3 text-[14px] font-semibold text-text first:mt-0">{children}</h4>
    ),
    h4: ({ children }) => (
      <h5 className="mt-3 text-[13px] font-semibold text-text first:mt-0">{children}</h5>
    ),
    h5: ({ children }) => (
      <h6 className="mt-3 text-[13px] font-semibold text-text first:mt-0">{children}</h6>
    ),
    h6: ({ children }) => (
      <h6 className="mt-3 text-[12px] font-semibold text-sub first:mt-0">{children}</h6>
    ),
    ul: ({ children, className }) => (
      <ul
        className={`${text} mt-2 flex flex-col gap-1 text-sub first:mt-0 ${
          className?.includes('contains-task-list') ? 'list-none pl-1' : 'list-disc pl-5'
        }`}
      >
        {children}
      </ul>
    ),
    ol: ({ children, start }) => (
      <ol
        start={start}
        className={`${text} mt-2 flex list-decimal flex-col gap-1 pl-5 text-sub first:mt-0`}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="marker:text-faint [&>p]:mt-0">{children}</li>,
    input: ({ checked }) => (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        readOnly
        disabled
        className="mr-2 align-middle"
      />
    ),
    blockquote: ({ children }) => (
      <blockquote className="mt-3 border-l-2 border-line pl-3 text-faint first:mt-0">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-4 border-line" />,
    strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="text-faint">{children}</del>,
    code: ({ children, className }) =>
      className?.startsWith('language-') ? (
        <code className={className}>{children}</code>
      ) : (
        <code className="rounded-[5px] bg-chip px-[5px] py-[1px] font-mono text-[12px] text-text">
          {children}
        </code>
      ),
    pre: ({ children }) => (
      <pre className="mt-3 overflow-x-auto rounded-9 border border-line bg-surface px-4 py-3 font-mono text-[12px] leading-[18px] text-text first:mt-0 [&_code]:bg-transparent [&_code]:p-0">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="mt-3 overflow-x-auto first:mt-0">
        <table className="w-full border-collapse text-left text-[12.5px]">{children}</table>
      </div>
    ),
    th: ({ children, style }) => (
      <th style={style} className="border border-line bg-surface px-3 py-2 font-semibold text-text">
        {children}
      </th>
    ),
    td: ({ children, style }) => (
      <td style={style} className="border border-line px-3 py-2 align-top text-sub">
        {children}
      </td>
    ),
    img: ({ src, alt }) => (
      <img
        src={typeof src === 'string' ? src : undefined}
        alt={alt ?? ''}
        className="mt-2 max-w-full rounded-9"
      />
    ),
  };
}

/** Строчные элементы, которые остаются в inline-режиме; блоки разворачиваются в текст */
const INLINE = ['p', 'a', 'strong', 'em', 'del', 'code', 'br'];

export function Markdown({
  text,
  resolveLink,
  inline = false,
  size = 'article',
}: {
  text: string;
  resolveLink?: ResolveLink;
  inline?: boolean;
  size?: 'article' | 'compact';
}) {
  const map = components(resolveLink, size);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={urlTransform}
      components={inline ? { ...map, p: ({ children }) => <>{children}</> } : map}
      {...(inline ? { allowedElements: INLINE, unwrapDisallowed: true } : {})}
    >
      {wikiToLinks(text)}
    </ReactMarkdown>
  );
}
