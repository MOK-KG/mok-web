import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BookIcon, DocSmallIcon, XIcon } from '@/shared/ui/icons';
import { useDocumentArticles } from './api';
import { capsTitle } from './parts';
import type { KbRelatedDocument } from './types';

type DocumentKind = 'incoming' | 'outgoing' | 'order' | 'other';

/** «Вх. №2026-0884 · Минюст» → входящий, номер «№2026-0884», корреспондент «Минюст» */
export function parseDocumentNumber(number: string): {
  kind: DocumentKind;
  number: string;
  party: string | null;
} {
  const [head, party = null] = number.split(' · ');
  const prefixes: [string, DocumentKind][] = [
    ['Вх.', 'incoming'],
    ['Исх.', 'outgoing'],
    ['Приказ', 'order'],
  ];
  const match = prefixes.find(([prefix]) => head.startsWith(prefix));
  return {
    kind: match?.[1] ?? 'other',
    number: match ? head.slice(match[0].length).trim() : head,
    party,
  };
}

/**
 * Карточка связанного документа. Пока раздела «Делопроизводство» нет — номер, тип,
 * корреспондент и статьи, где документ упомянут; полная карточка появится в том разделе.
 */
export function DocumentDialog({
  document: doc,
  onClose,
}: {
  document: KbRelatedDocument | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const articles = useDocumentArticles(doc);
  const parsed = doc ? parseDocumentNumber(doc.number) : null;
  const row = 'flex gap-3 py-[7px] text-[12px]';

  return (
    <Dialog.Root open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-48px)] w-[min(480px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-18 border border-line bg-panel px-[23px] pb-[22px] pt-[21px] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          {doc && parsed && (
            <>
              <div className="flex items-start gap-[10px] pr-10">
                <DocSmallIcon size={16} className="mt-[3px] shrink-0 text-faint" />
                <div className="min-w-0">
                  <Dialog.Title className="text-[17px] font-semibold tracking-[-0.3px] text-text">
                    {doc.title}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-[11.5px] text-faint">
                    {doc.number}
                  </Dialog.Description>
                </div>
              </div>

              <dl className="mt-4 border-y border-line py-[6px]">
                <div className={row}>
                  <dt className="w-[120px] shrink-0 text-dim">{t('knowledge.docKind')}</dt>
                  <dd className="text-sub">{t(`knowledge.docKinds.${parsed.kind}`)}</dd>
                </div>
                <div className={row}>
                  <dt className="w-[120px] shrink-0 text-dim">{t('knowledge.docNumber')}</dt>
                  <dd className="text-sub">{parsed.number}</dd>
                </div>
                {parsed.party && (
                  <div className={row}>
                    <dt className="w-[120px] shrink-0 text-dim">
                      {parsed.kind === 'order' ? t('knowledge.docIssuer') : t('knowledge.docParty')}
                    </dt>
                    <dd className="text-sub">{parsed.party}</dd>
                  </div>
                )}
              </dl>

              <h3 className={`${capsTitle} mt-4`}>{t('knowledge.docArticles')}</h3>
              <ul className="mt-2 flex flex-col gap-[6px]">
                {(articles.data ?? []).map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/knowledge/${a.id}`}
                      onClick={onClose}
                      className="flex items-center gap-[9px] rounded-8 border border-line bg-surface px-[11px] py-[9px] text-[12px] text-sub hover:border-info-line hover:text-text"
                    >
                      <BookIcon size={15} className="shrink-0 text-faint" />
                      <span className="truncate">{a.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-[11px] leading-4 text-dim">{t('knowledge.docNote')}</p>
            </>
          )}
          <Dialog.Close
            aria-label={t('knowledge.close')}
            className="absolute right-[19px] top-[19px] flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
