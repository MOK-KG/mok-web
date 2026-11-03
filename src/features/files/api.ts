import { useMemo } from 'react';
import { useCan } from '@/features/auth';
import { chatMembers, useChatFiles } from '@/features/chat/api';
import { useDocuments } from '@/features/documents/api';
import { useKnowledgeFiles } from '@/features/knowledge-base/api';
import { collectFiles, type FileSource } from './collect';

/**
 * Файлы из разделов, которые открыты пользователю: без права на раздел его файлы
 * не запрашиваются и не показываются. Когда появится бэкенд — один запрос /files.
 *
 * Файл продублирован в web/ и mobile/ — правьте оба.
 */
export function useFiles() {
  const { can } = useCan();
  const allowed: Record<FileSource, boolean> = {
    documents: can('documents.view'),
    knowledge: can('knowledge.view'),
    chat: can('chat.use'),
  };
  const documents = useDocuments(allowed.documents);
  const knowledge = useKnowledgeFiles(allowed.knowledge);
  const chat = useChatFiles(allowed.chat);

  const items = useMemo(
    () =>
      collectFiles({
        documents: allowed.documents ? documents.data : [],
        knowledge: allowed.knowledge ? knowledge.data : [],
        chat: allowed.chat ? chat.data : [],
        memberName: (id) => chatMembers[id]?.short ?? null,
      }),
    [allowed.documents, allowed.knowledge, allowed.chat, documents.data, knowledge.data, chat.data],
  );

  const pending =
    (allowed.documents && documents.isPending) ||
    (allowed.knowledge && knowledge.isPending) ||
    (allowed.chat && chat.isPending);

  return { items, pending, allowed };
}
