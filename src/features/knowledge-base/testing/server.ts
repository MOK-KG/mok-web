import { vi } from 'vitest';
import type { Person } from '@/features/tasks/types';
import type { RoleCode } from '@/shared/config/permissions';
import { type IsoDate, todayInBishkek } from '@/shared/lib/workDays';
import type { ApiPerson } from '../api';
import { blocksToMarkdown, markdownToBlocks } from '../markdown';
import { matchesQuery } from '../search';
import type { KbArticle, KbAttachment } from '../types';
import { createMockKnowledge } from './fixtures';

/**
 * Подставной бэкенд базы знаний для тестов: те же адреса и формат ответов, что у mok-backend
 * (apps/knowledge/views.py), данные — из fixtures.ts. Подменяет fetch, приложение работает
 * через настоящий клиент API.
 *
 * Роли берутся из сессии заглушки входа (sessionStorage), если её нет — из options.roles.
 */

type Section = { id: string; name: string; openTo?: RoleCode[] };
type Reply = { status: number; body?: unknown };

const apiPerson = (p: Person): ApiPerson => ({
  id: p.id,
  email: `${p.id}@olympic.kg`,
  name: p.name,
});

const SESSION_KEY = 'nok.mockSession';

function sessionUser(): { roles: RoleCode[]; person: ApiPerson } | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const { user } = JSON.parse(raw) as { user: { email: string; name: string; roles: RoleCode[] } };
  return { roles: user.roles, person: { id: user.email, email: user.email, name: user.name } };
}

export function createKnowledgeServer({
  today = todayInBishkek(),
  roles: defaultRoles = ['R1'] as RoleCode[],
} = {}) {
  const data = createMockKnowledge(today);
  const sections: Section[] = data.sections.map(({ id, name, openTo }) => ({ id, name, openTo }));
  const articles: KbArticle[] = data.articles;
  /** Кто правил статью — сотрудник из сессии (статьи фикстур — с авторами из макета) */
  const editors = new Map<string, ApiPerson>();
  const reviewers = new Map<string, ApiPerson>();
  const archived = new Set<string>();
  /** Загруженные файлы: ID вложения → файл */
  const files = new Map<string, File>();
  let nextId = 1;

  const current = () => sessionUser() ?? { roles: defaultRoles, person: apiPerson(fallback) };
  const fallback: Person = { id: 'u-ad', name: 'Айбек Дуйшеев', short: '', tone: 'blue' };
  const isOpen = (sectionId: string, roles: RoleCode[]) => {
    const s = sections.find((x) => x.id === sectionId);
    return !s?.openTo || s.openTo.some((r) => roles.includes(r));
  };
  const visible = (roles: RoleCode[]) => articles.filter((a) => isOpen(a.sectionId, roles));
  const attachmentsOf = (a: KbArticle) => a.attachments.filter((x) => !archived.has(x.id));
  const fileName = (x: KbAttachment) => (x.ext ? `${x.name}.${x.ext}` : x.name);

  const section = (s: Section, roles: RoleCode[]) => ({
    id: s.id,
    name: s.name,
    count: articles.filter((a) => a.sectionId === s.id).length,
    accessible: isOpen(s.id, roles),
    roles: s.openTo ? [...s.openTo] : null,
  });
  const summary = (a: KbArticle) => ({
    id: a.id,
    sectionId: a.sectionId,
    title: a.title,
    summary: a.summary,
    author: apiPerson(a.author),
    updatedAt: a.updatedAt,
    reviewed: a.reviewed && {
      date: a.reviewed.date,
      by: reviewers.get(a.id) ?? apiPerson(a.reviewed.by),
    },
    tasksCount: a.relatedTasks.length,
    documentsCount: a.relatedDocuments.length,
  });
  const article = (a: KbArticle) => ({
    ...summary(a),
    version: a.version,
    body: blocksToMarkdown(a.body),
    archived: false,
    attachments: attachmentsOf(a).map((x) => ({
      id: x.id,
      filename: fileName(x),
      size: x.size ?? 1024,
    })),
    relatedTasks: a.relatedTasks,
    relatedDocuments: a.relatedDocuments,
    versions: a.versions.map((v) => ({
      ...v,
      author: editors.get(`${a.id}:${v.number}`) ?? apiPerson(v.author),
      body: blocksToMarkdown(v.body),
    })),
  });

  const error = (status: number, code: string): Reply => ({ status, body: { code, detail: code } });

  const sectionName = (name: string, except?: string): string | Reply => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean.length < 3 || clean.length > 60) return error(400, 'section_name');
    if (sections.some((s) => s.id !== except && s.name.toLowerCase() === clean.toLowerCase())) {
      return error(409, 'section_exists');
    }
    return clean;
  };

  type Body = Record<string, unknown>;
  const write = (a: KbArticle | null, body: Body, roles: RoleCode[], person: ApiPerson) => {
    const sectionId = String(body.sectionId ?? a?.sectionId);
    if (!sections.some((s) => s.id === sectionId) || !isOpen(sectionId, roles)) {
      return error(403, 'forbidden');
    }
    const fields = {
      sectionId,
      title: String(body.title ?? a?.title ?? ''),
      summary: String(body.summary ?? a?.summary ?? ''),
      body: markdownToBlocks(String(body.body ?? '')),
      relatedTasks: (body.relatedTasks ?? a?.relatedTasks ?? []) as KbArticle['relatedTasks'],
      relatedDocuments: (body.relatedDocuments ??
        a?.relatedDocuments ??
        []) as KbArticle['relatedDocuments'],
      updatedAt: todayInBishkek(),
    };
    const author: Person = { id: person.id, name: person.name, short: '', tone: 'blue' };
    const snap = { title: fields.title, summary: fields.summary, body: fields.body };
    const change = String(body.change ?? '');
    let saved: KbArticle;
    if (!a) {
      saved = {
        id: `kb-${articles.length + 1}`,
        ...fields,
        author,
        reviewed: null,
        tasksCount: 0,
        documentsCount: 0,
        version: 1,
        attachments: [],
        versions: [{ number: 1, date: fields.updatedAt, author, change, ...snap }],
      };
      articles.push(saved);
    } else {
      if (body.version !== a.version) return error(409, 'version_conflict');
      const version = a.version + 1;
      saved = Object.assign(a, fields, {
        version,
        versions: [
          { number: version, date: fields.updatedAt, author, change, ...snap },
          ...a.versions,
        ],
      });
    }
    editors.set(`${saved.id}:${saved.version}`, person);
    return { status: a ? 200 : 201, body: article(saved) };
  };

  function handle(method: string, path: string, query: URLSearchParams, body: unknown): Reply {
    const { roles, person } = current();
    const b = (body ?? {}) as Body;
    if (path === '/auth/csrf') return { status: 200, body: { csrfToken: 'test' } };
    if (!path.startsWith('/knowledge/')) return error(404, 'not_found');
    const [, , resource, id, action] = path.split('/');
    const find = (articleId: string): KbArticle | Reply => {
      const a = articles.find((x) => x.id === articleId);
      if (!a) return error(404, 'not_found');
      if (!isOpen(a.sectionId, roles)) return error(403, 'forbidden');
      return a;
    };
    const isReply = (x: unknown): x is Reply => !!x && typeof x === 'object' && 'status' in x;

    if (resource === 'overview' && method === 'GET') {
      return {
        status: 200,
        body: {
          sections: sections.map((s) => section(s, roles)),
          articles: visible(roles)
            .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
            .map(summary),
        },
      };
    }
    if (resource === 'search') {
      const q = query.get('q') ?? '';
      const hits = visible(roles).filter((a) => matchesQuery(a, q));
      return { status: 200, body: hits.map((a) => ({ document: { slug: a.id } })) };
    }
    if (resource === 'files') {
      return {
        status: 200,
        body: visible(roles).flatMap((a) =>
          attachmentsOf(a).map((x) => ({
            attachment: { id: x.id, filename: fileName(x), size: x.size ?? 1024 },
            articleId: a.id,
            articleTitle: a.title,
            author: apiPerson(a.author),
            updatedAt: a.updatedAt,
          })),
        ),
      };
    }
    if (resource === 'sections') {
      if (!id && method === 'POST') {
        const name = sectionName(String(b.name ?? ''));
        if (typeof name !== 'string') return name;
        const created: Section = { id: `sec-${nextId++}`, name };
        sections.push(created);
        return { status: 201, body: section(created, roles) };
      }
      const s = sections.find((x) => x.id === id);
      if (!s) return error(404, 'not_found');
      if (action === 'move') {
        const from = sections.indexOf(s);
        const to = from + Number(b.by);
        if (to >= 0 && to < sections.length) sections.splice(to, 0, ...sections.splice(from, 1));
        return { status: 204 };
      }
      if ('name' in b) {
        const name = sectionName(String(b.name), s.id);
        if (typeof name !== 'string') return name;
        s.name = name;
      }
      if ('roles' in b) {
        const r = b.roles as RoleCode[] | null;
        if (r && r.length === 0) return error(400, 'section_roles');
        s.openTo = r ? [...new Set(r)].sort() : undefined;
      }
      return { status: 200, body: section(s, roles) };
    }
    if (resource === 'articles') {
      if (!id && method === 'GET') {
        const number = query.get('document');
        const found = visible(roles).filter((a) =>
          a.relatedDocuments.some((d) => d.number === number),
        );
        return { status: 200, body: found.map(summary) };
      }
      if (!id && method === 'POST') return write(null, b, roles, person);
      const a = find(id);
      if (isReply(a)) return a;
      if (!action && method === 'GET') return { status: 200, body: article(a) };
      if (!action && method === 'PATCH') return write(a, b, roles, person);
      if (action === 'review') {
        a.reviewed = { date: todayInBishkek(), by: a.author };
        reviewers.set(a.id, person);
        return { status: 200, body: article(a) };
      }
      if (action === 'attachments') {
        const file = (body as FormData).get('file') as File;
        const dot = file.name.lastIndexOf('.');
        const added = {
          id: `att-new-${nextId++}`,
          name: dot > 0 ? file.name.slice(0, dot) : file.name,
          ext: dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '',
          size: file.size,
        };
        a.attachments.push(added);
        files.set(added.id, file);
        return { status: 201, body: { id: added.id, filename: file.name } };
      }
    }
    if (resource === 'attachments' && action === 'archive') {
      archived.add(id);
      return { status: 200, body: { id, archived: true } };
    }
    return error(404, 'not_found');
  }

  return { handle, articles, sections, files, archived };
}

export type KnowledgeServer = ReturnType<typeof createKnowledgeServer>;

/** Подменить fetch подставным сервером; снять — vi.unstubAllGlobals() */
export function installKnowledgeServer(options?: { today?: IsoDate; roles?: RoleCode[] }) {
  const server = createKnowledgeServer(options);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
      const raw = init.body;
      const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const reply = server.handle(init.method ?? 'GET', path, url.searchParams, body);
      return reply.status === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(reply.body), {
            status: reply.status,
            headers: { 'Content-Type': 'application/json' },
          });
    }),
  );
  return server;
}
