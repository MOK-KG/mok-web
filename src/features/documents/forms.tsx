import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PaperclipIcon } from '@/shared/ui/icons';
import { type DraftInput, useCreateDraft, useRegisterIncoming } from './api';
import { FieldError, FormDialog, fieldBox, label, primaryButton, secondaryButton } from './parts';
import type { DocKind, DocumentRecord } from './types';

type Props = {
  /** Какой документ создаём; null — окно закрыто */
  kind: DocKind | null;
  onClose: () => void;
  onCreated: (doc: DocumentRecord) => void;
};

/**
 * Регистрация входящего (номер выдаётся сразу) или проект исходящего / приказа
 * (номер — при отправке или подписании).
 */
export function NewDocumentDialog({ kind, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  return (
    <FormDialog
      open={kind !== null}
      title={kind ? t(`documents.new.${kind}`) : ''}
      onClose={onClose}
    >
      {kind && <Form kind={kind} onClose={onClose} onCreated={onCreated} />}
    </FormDialog>
  );
}

function Form({ kind, onClose, onCreated }: { kind: DocKind } & Omit<Props, 'kind'>) {
  const { t } = useTranslation();
  const register = useRegisterIncoming();
  const draft = useCreateDraft();
  const [title, setTitle] = useState('');
  const [party, setParty] = useState('');
  const [senderRef, setSenderRef] = useState('');
  const [summary, setSummary] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = register.isPending || draft.isPending;

  const titleError = title.trim().length < 3 ? t('documents.form.errorTitle') : null;
  const partyError =
    kind !== 'order' && party.trim().length < 2 ? t('documents.form.errorParty') : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (titleError || partyError) return;
    const done = (doc: DocumentRecord) => {
      onCreated(doc);
      onClose();
    };
    if (kind === 'incoming') {
      register.mutate(
        { title, party, senderRef, summary, attachments: files },
        { onSuccess: done },
      );
    } else {
      const input: DraftInput = { kind, title, party, summary, attachments: files };
      draft.mutate(input, { onSuccess: done });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
      <p className="text-[12px] leading-[17px] text-faint">{t(`documents.form.hint.${kind}`)}</p>
      <div>
        <label htmlFor="doc-title" className={label}>
          {t('documents.form.title')}
        </label>
        <input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={tried && !!titleError}
          data-invalid={tried && !!titleError}
          className={`${fieldBox} mt-[6px]`}
          placeholder={t('documents.form.titlePlaceholder')}
        />
        <FieldError text={tried ? titleError : null} />
      </div>
      {kind !== 'order' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="doc-party" className={label}>
              {t(`documents.form.party.${kind}`)}
            </label>
            <input
              id="doc-party"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              aria-invalid={tried && !!partyError}
              data-invalid={tried && !!partyError}
              className={`${fieldBox} mt-[6px]`}
            />
            <FieldError text={tried ? partyError : null} />
          </div>
          {kind === 'incoming' && (
            <div>
              <label htmlFor="doc-ref" className={label}>
                {t('documents.form.senderRef')}
              </label>
              <input
                id="doc-ref"
                value={senderRef}
                onChange={(e) => setSenderRef(e.target.value)}
                className={`${fieldBox} mt-[6px]`}
                placeholder="№ 12-04/518"
              />
            </div>
          )}
        </div>
      )}
      <div>
        <label htmlFor="doc-summary" className={label}>
          {t('documents.form.summary')}
        </label>
        <textarea
          id="doc-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          className={`${fieldBox} mt-[6px] py-[10px]`}
        />
      </div>
      <div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const names = [...(e.target.files ?? [])].map((f) => f.name);
            setFiles((prev) => [...prev, ...names.filter((n) => !prev.includes(n))]);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-2 text-[12px] font-medium text-info hover:underline"
        >
          <PaperclipIcon size={14} />
          {t('documents.form.attach')}
        </button>
        {files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-[6px]">
            {files.map((f) => (
              <li
                key={f}
                className="flex items-center gap-[6px] rounded-6 bg-chip px-2 py-1 text-[11px] text-chip-text"
              >
                {f}
                <button
                  type="button"
                  aria-label={t('documents.form.removeFile', { name: f })}
                  onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                  className="text-faint hover:text-text"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={secondaryButton}>
          {t('documents.cancel')}
        </button>
        <button type="submit" disabled={pending} className={primaryButton}>
          {t(`documents.form.submit.${kind}`)}
        </button>
      </div>
    </form>
  );
}
