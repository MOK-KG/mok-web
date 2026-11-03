import { useMemo } from 'react';
import { useCan } from '@/features/auth';
import { useMemberMessages } from '@/features/chat/api';
import { useDocuments } from '@/features/documents/api';
import { useFiles } from '@/features/files/api';
import { useKnowledge, useKnowledgeSearch } from '@/features/knowledge-base/api';
import { useTasks } from '@/features/tasks/api';
import { type SearchKind, type SearchResults, searchAll } from './search';

/**
 * Поиск по системе с правами пользователя: без права на раздел его данные не запрашиваются,
 * значит не находятся и не считаются (приёмка 11.3). Закрытые разделы Базы знаний
 * отсекает её собственный поиск.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export function useSearch(query: string): {
  results: SearchResults;
  allowed: Record<SearchKind, boolean>;
  pending: boolean;
} {
  const { can } = useCan();
  const allowed: Record<SearchKind, boolean> = {
    tasks: can('tasks.view'),
    documents: can('documents.view'),
    knowledge: can('knowledge.view'),
    files: can('files.view'),
    chat: can('chat.use'),
  };
  const active = useTasks('department');
  const archive = useTasks('completed');
  const documents = useDocuments(allowed.documents);
  const knowledge = useKnowledge();
  const inText = useKnowledgeSearch(allowed.knowledge ? query : '');
  const files = useFiles();
  const messages = useMemberMessages(allowed.chat);

  const results = useMemo(
    () =>
      searchAll(query, {
        tasks: allowed.tasks ? [...(active.data ?? []), ...(archive.data ?? [])] : [],
        documents: allowed.documents ? documents.data : [],
        articles: allowed.knowledge ? knowledge.data?.articles : [],
        articleIds: allowed.knowledge ? inText.data?.ids : [],
        files: allowed.files ? files.items : [],
        messages: allowed.chat ? messages.data : [],
      }),
    [
      query,
      allowed.tasks,
      allowed.documents,
      allowed.knowledge,
      allowed.files,
      allowed.chat,
      active.data,
      archive.data,
      documents.data,
      knowledge.data,
      inText.data,
      files.items,
      messages.data,
    ],
  );

  const pending =
    (allowed.tasks && active.isPending) ||
    (allowed.documents && documents.isPending) ||
    (allowed.knowledge && knowledge.isPending);

  return { results, allowed, pending };
}
