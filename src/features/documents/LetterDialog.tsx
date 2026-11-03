import * as Dialog from '@radix-ui/react-dialog';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCan } from '@/features/auth';
import { toast } from '@/shared/lib/toast';
import { DownloadIcon, FileIcon, XIcon } from '@/shared/ui/icons';
import { docNumber, useUpdateLetter } from './api';
import {
  defaultLetter,
  fillTemplate,
  type Letter,
  type LetterTemplateId,
  letterLangs,
  letterTemplateIds,
  switchLang,
} from './letter';
import { letterHtml } from './letterHtml';
import { capsTitle, fieldBox, label, primaryButton, secondaryButton } from './parts';
import type { DocumentRecord } from './types';

/**
 * Исходящее письмо на бланке (S-07): слева — правка проекта (язык, шаблон, адресат, текст),
 * справа — лист A4 ровно таким, каким он напечатается. Печать или PDF — через диалог печати,
 * .docx — файлом; логотип и подпись встроены в оба (приёмка 11.14).
 * Отправленное письмо не редактируется: у него отпечаток содержания.
 */
export function LetterDialog({
  doc,
  signer,
  open,
  onClose,
}: {
  doc: DocumentRecord;
  signer: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-4 z-[70] flex flex-col overflow-hidden rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          {open && <Body doc={doc} signer={signer} />}
          <Dialog.Close
            aria-label={t('taskCard.close')}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ doc, signer }: { doc: DocumentRecord; signer: string }) {
  const { t } = useTranslation();
  const { can } = useCan();
  const update = useUpdateLetter();
  const editable = doc.status === 'draft' && (can('documents.create') || can('documents.register'));
  const [letter, setLetter] = useState<Letter>(
    () => doc.letter ?? defaultLetter(doc.party, doc.summary),
  );
  const [title, setTitle] = useState(doc.title);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const dirty =
    title !== doc.title || JSON.stringify(letter) !== JSON.stringify(doc.letter ?? null);
  const view = { doc: { ...doc, title }, letter, signer };
  const html = letterHtml(view);
  const number = docNumber(doc);
  const fileName = (number ?? doc.title).replace(/[^\p{L}\p{N}-]+/gu, '_');

  const set = (patch: Partial<Letter>) => setLetter((l) => ({ ...l, ...patch }));
  const applyTemplate = (id: LetterTemplateId) =>
    set({ templateId: id, body: fillTemplate(id, letter.lang) });

  const print = () => frame.current?.contentWindow?.print();
  const downloadDocx = async () => {
    setBusy(true);
    try {
      const { letterDocx } = await import('./letterDocx');
      const blob = await letterDocx(view);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error({ title: t('documents.letter.docxFailed') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4 pr-16">
        <FileIcon size={16} className="text-faint" />
        <Dialog.Title className="text-[15px] font-semibold tracking-[-0.2px] text-text">
          {t('documents.letter.title')} · {number ?? t('documents.noNumber')}
        </Dialog.Title>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className={secondaryButton} onClick={print}>
            {t('documents.letter.print')}
          </button>
          <button type="button" className={secondaryButton} onClick={downloadDocx} disabled={busy}>
            <DownloadIcon size={15} />
            .docx
          </button>
          {editable && (
            <button
              type="button"
              className={primaryButton}
              disabled={!dirty || update.isPending}
              onClick={() => update.mutate({ id: doc.id, letter, title })}
            >
              {t('documents.letter.save')}
            </button>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[380px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line p-5">
          {editable ? (
            <>
              <div>
                <span className={label}>{t('documents.letter.lang')}</span>
                <div className="mt-[6px] flex gap-1 rounded-9 border border-line bg-control p-[3px]">
                  {letterLangs.map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={letter.lang === l}
                      onClick={() => setLetter((cur) => switchLang(cur, l))}
                      className={`h-8 flex-1 rounded-[7px] text-[12px] uppercase ${
                        letter.lang === l
                          ? 'bg-control-active font-semibold text-text'
                          : 'text-sub hover:text-text'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-dim">{t('documents.letter.langHint')}</p>
              </div>
              <div>
                <label htmlFor="letter-template" className={label}>
                  {t('documents.letter.template')}
                </label>
                <select
                  id="letter-template"
                  value={letter.templateId}
                  onChange={(e) => applyTemplate(e.target.value as LetterTemplateId)}
                  className={`${fieldBox} mt-[6px]`}
                >
                  {letterTemplateIds.map((id) => (
                    <option key={id} value={id}>
                      {t(`documents.letter.templates.${id}`)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-dim">{t('documents.letter.templateHint')}</p>
              </div>
              <div>
                <label htmlFor="letter-subject" className={label}>
                  {t('documents.form.title')}
                </label>
                <input
                  id="letter-subject"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`${fieldBox} mt-[6px]`}
                />
              </div>
              <div>
                <label htmlFor="letter-to" className={label}>
                  {t('documents.letter.addressee')}
                </label>
                <textarea
                  id="letter-to"
                  rows={3}
                  value={letter.addressee}
                  onChange={(e) => set({ addressee: e.target.value })}
                  className={`${fieldBox} mt-[6px] py-[9px]`}
                />
              </div>
              <div>
                <label htmlFor="letter-email" className={label}>
                  {t('documents.form.email')}
                </label>
                <input
                  id="letter-email"
                  type="email"
                  value={letter.email}
                  onChange={(e) => set({ email: e.target.value })}
                  placeholder="info@minjust.gov.kg"
                  className={`${fieldBox} mt-[6px]`}
                />
                <p className="mt-1 text-[11px] text-dim">{t('documents.form.emailHint')}</p>
              </div>
              <div className="flex min-h-[220px] flex-1 flex-col">
                <label htmlFor="letter-body" className={label}>
                  {t('documents.letter.body')}
                </label>
                <textarea
                  id="letter-body"
                  value={letter.body}
                  onChange={(e) => set({ body: e.target.value })}
                  className={`${fieldBox} mt-[6px] flex-1 py-[9px] leading-[19px]`}
                />
              </div>
              <p className="text-[11px] leading-4 text-dim">{t('documents.issueHint')}</p>
            </>
          ) : (
            <div className="flex flex-col gap-3 text-[12.5px] text-sub">
              <h3 className={capsTitle}>{t('documents.letter.locked')}</h3>
              <p className="leading-[18px]">
                {doc.status === 'draft'
                  ? t('documents.letter.noRights')
                  : t('documents.letter.lockedHint')}
              </p>
              {doc.fingerprint && (
                <p>
                  {t('documents.letter.fingerprint')}:{' '}
                  <span className="font-mono text-text">{doc.fingerprint}</span>
                </p>
              )}
            </div>
          )}
          <p className="mt-auto text-[10.5px] leading-[15px] text-dim">
            {t('documents.letter.embedNote')}
          </p>
        </div>
        <div className="min-w-0 flex-1 overflow-auto bg-surface p-6">
          <iframe
            ref={frame}
            title={t('documents.letter.preview')}
            srcDoc={html}
            className="mx-auto block h-[1123px] w-[794px] rounded-6 bg-[#FFFFFF] shadow-[0_6px_24px_rgba(0,0,0,0.25)]"
          />
        </div>
      </div>
    </>
  );
}
