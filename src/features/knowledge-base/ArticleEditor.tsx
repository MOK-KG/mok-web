import { zodResolver } from '@hookform/resolvers/zod';
import * as Select from '@radix-ui/react-select';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { ForbiddenPage } from '@/features/auth';
import { useTasks } from '@/features/tasks/api';
import { ApiError } from '@/shared/api/errors';
import {
  AttachLargeIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronSmallIcon,
  DocSmallIcon,
  PlusSmallIcon,
  TasksSmallIcon,
  XIcon,
} from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import {
  type ArticleDraft,
  useArticle,
  useKnowledge,
  useLinkableDocuments,
  useSaveArticle,
} from './api';
import { capsTitle } from './parts';
import { SectionDialog } from './SectionDialog';
import type {
  KbArticle,
  KbAttachment,
  KbBlock,
  KbRelatedDocument,
  KbRelatedTask,
  KbSection,
} from './types';

const blockKinds = ['paragraph', 'heading', 'list', 'note'] as const;
type BlockKind = (typeof blockKinds)[number];

/** Блок в форме: одна плоская запись на все виды; список — пункты с новой строки */
type BlockField = { kind: BlockKind; anchor: string; text: string; title: string };

const SUMMARY_MAX = 200;

/** Значение пункта «Новый раздел» в списке разделов — не ID раздела */
const NEW_SECTION = '__new__';

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const blockSchema = z
  .object({
    kind: z.enum(blockKinds),
    anchor: z.string(),
    text: z.string(),
    title: z.string(),
  })
  .superRefine((b, ctx) => {
    const empty =
      b.kind === 'list'
        ? lines(b.text).length === 0
        : b.kind === 'note'
          ? !b.title.trim() || !b.text.trim()
          : !b.text.trim();
    if (empty) ctx.addIssue({ code: 'custom', path: ['text'], message: 'errorBlock' });
  });

const schemaFor = (editing: boolean) =>
  z.object({
    sectionId: z.string().min(1, 'errorSection'),
    title: z.string().trim().min(3, 'errorTitle'),
    summary: z.string().trim().min(10, 'errorSummary').max(SUMMARY_MAX, 'errorSummary'),
    blocks: z.array(blockSchema).min(1, 'errorBody'),
    attachments: z.array(z.object({ id: z.string(), name: z.string(), ext: z.string() })),
    relatedTasks: z.array(
      z.object({
        id: z.string().nullable(),
        title: z.string(),
        status: z.custom<KbRelatedTask['status']>(),
      }),
    ),
    relatedDocuments: z.array(z.object({ number: z.string(), title: z.string() })),
    // Для новой статьи строка истории — «первая редакция», при правке её пишет автор
    change: editing ? z.string().trim().min(3, 'errorChange') : z.string(),
  });

type FormValues = z.infer<ReturnType<typeof schemaFor>>;

const toField = (b: KbBlock): BlockField => {
  switch (b.kind) {
    case 'heading':
      return { kind: b.kind, anchor: b.id, text: b.text, title: '' };
    case 'list':
      return { kind: b.kind, anchor: '', text: b.items.join('\n'), title: '' };
    case 'note':
      return { kind: b.kind, anchor: '', text: b.text, title: b.title };
    default:
      return { kind: b.kind, anchor: '', text: b.text, title: '' };
  }
};

/** Поля формы → блоки статьи. Якорь заголовка сохраняется: на него ведут ссылки содержания */
function toBlocks(fields: BlockField[]): KbBlock[] {
  const used = new Set(fields.map((f) => f.anchor).filter(Boolean));
  let n = 0;
  const nextAnchor = () => {
    do n += 1;
    while (used.has(`h-${n}`));
    used.add(`h-${n}`);
    return `h-${n}`;
  };
  return fields.map((f): KbBlock => {
    switch (f.kind) {
      case 'heading':
        return { kind: 'heading', id: f.anchor || nextAnchor(), text: f.text.trim() };
      case 'list':
        return { kind: 'list', items: lines(f.text) };
      case 'note':
        return { kind: 'note', title: f.title.trim(), text: f.text.trim() };
      default:
        return { kind: 'paragraph', text: f.text.trim() };
    }
  });
}

const emptyBlock = (kind: BlockKind): BlockField => ({ kind, anchor: '', text: '', title: '' });

/** Файл → вложение: имя без расширения и расширение отдельно, как в карточке статьи */
const toAttachment = (file: File): KbAttachment => {
  const dot = file.name.lastIndexOf('.');
  return {
    id: `att-${crypto.randomUUID()}`,
    name: dot > 0 ? file.name.slice(0, dot) : file.name,
    ext: dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '',
  };
};

const sameDocument = (a: KbRelatedDocument, b: KbRelatedDocument) =>
  a.number === b.number && a.title === b.title;

/** Редактор статьи: /knowledge/new и /knowledge/:articleId/edit (право knowledge.edit) */
export function ArticleEditor() {
  const { t } = useTranslation();
  const { articleId } = useParams();
  const editing = articleId !== undefined;
  const article = useArticle(articleId ?? '', { enabled: editing });
  const list = useKnowledge();

  if (article.error instanceof ApiError && article.error.status === 403) return <ForbiddenPage />;
  if (editing && article.isError) {
    return (
      <p className="mt-16 text-center text-[13px] text-sub">
        {article.error instanceof ApiError && article.error.status === 404
          ? t('knowledge.notFoundTitle')
          : t('knowledge.loadError')}
      </p>
    );
  }
  if (!list.data || (editing && !article.data)) return null;
  return <EditorForm article={article.data ?? null} sections={list.data.sections} />;
}

const label = 'block text-[10.5px] font-medium tracking-[0.2px] text-sub';
const fieldBox =
  'w-full rounded-8 border border-line bg-column px-[13px] text-[12.5px] text-text outline-none placeholder:text-dim focus:border-info data-[invalid=true]:border-danger';

function EditorForm({ article, sections }: { article: KbArticle | null; sections: KbSection[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const save = useSaveArticle(article?.id ?? null);
  const [sectionDialog, setSectionDialog] = useState(false);
  // Созданный раздел виден в списке сразу, не дожидаясь перезагрузки разделов
  const [created, setCreated] = useState<KbSection[]>([]);
  const open = [
    ...sections.filter((s) => s.accessible),
    ...created.filter((c) => !sections.some((s) => s.id === c.id)),
  ];
  const editing = article !== null;

  const {
    control,
    register,
    setValue,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schemaFor(editing)),
    defaultValues: article
      ? {
          sectionId: article.sectionId,
          title: article.title,
          summary: article.summary,
          blocks: article.body.map(toField),
          attachments: article.attachments,
          relatedTasks: article.relatedTasks,
          relatedDocuments: article.relatedDocuments,
          change: '',
        }
      : {
          sectionId: open.find((s) => s.id === params.get('section'))?.id ?? '',
          title: '',
          summary: '',
          blocks: [emptyBlock('paragraph')],
          attachments: [],
          relatedTasks: [],
          relatedDocuments: [],
          change: '',
        },
  });
  const blocks = useFieldArray({ control, name: 'blocks' });
  const values = useWatch({ control });
  const section = open.find((s) => s.id === values.sectionId);

  usePageSubtitle(editing ? t('knowledge.editTitle') : t('knowledge.newArticle'));

  // Несохранённые правки: спросить перед уходом со страницы и перед закрытием вкладки
  const saved = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !saved.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(t('knowledge.leaveConfirm'))) blocker.proceed();
    else blocker.reset();
  }, [blocker, t]);
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const backUrl = article
    ? `/knowledge/${article.id}`
    : `/knowledge${values.sectionId ? `?section=${values.sectionId}` : ''}`;

  const submit = handleSubmit(async (v) => {
    const draft: ArticleDraft = {
      sectionId: v.sectionId,
      title: v.title,
      summary: v.summary,
      body: toBlocks(v.blocks),
      attachments: v.attachments,
      relatedTasks: v.relatedTasks,
      relatedDocuments: v.relatedDocuments,
      change: editing ? v.change : t('knowledge.firstVersion'),
    };
    const result = await save.mutateAsync(draft).catch(() => null);
    if (!result) return;
    saved.current = true;
    navigate(`/knowledge/${result.id}`, { replace: true });
  });

  const error = (key?: string) =>
    key ? <p className="mt-1 text-[11px] text-danger">{t(`knowledge.${key}`)}</p> : null;

  const toc = (values.blocks ?? []).filter((b) => b.kind === 'heading' && b.text?.trim());

  return (
    <form onSubmit={submit} noValidate className="flex flex-col leading-[normal]">
      <nav
        aria-label={t('knowledge.back')}
        className="-mt-[2px] flex h-7 items-center text-[12.5px]"
      >
        <Tooltip content={t('knowledge.cancel')}>
          <Link
            to={backUrl}
            aria-label={t('knowledge.cancel')}
            className="mr-[6px] flex size-6 items-center justify-center rounded-6 text-sub hover:bg-row-highlight hover:text-text"
          >
            <ChevronLeftIcon size={16} />
          </Link>
        </Tooltip>
        <Link to="/knowledge" className="text-sub hover:text-text">
          {t('sections.knowledge')}
        </Link>
        {(article || section) && (
          <>
            <span aria-hidden className="mx-[10px] text-dim">
              /
            </span>
            <span className="font-medium text-faint">{article?.title ?? section?.name}</span>
          </>
        )}
      </nav>

      <div className="mt-[10px] flex items-start gap-4">
        <section
          aria-label={editing ? t('knowledge.editTitle') : t('knowledge.newArticle')}
          className="min-w-0 flex-1 rounded-14 border border-line bg-panel px-[23px] pb-6 pt-[23px]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className={capsTitle}>
              {editing ? t('knowledge.editTitle') : t('knowledge.newArticle')}
            </h2>
            <div className="flex items-center gap-2">
              <Link
                to={backUrl}
                className="flex h-8 items-center rounded-9 border border-line px-3 text-[12.5px] font-medium text-sub hover:text-text"
              >
                {t('knowledge.cancel')}
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-8 items-center gap-[6px] rounded-9 bg-brand-red px-3 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90 disabled:opacity-60"
              >
                <CheckIcon size={14} />
                {editing ? t('knowledge.save') : t('knowledge.publish')}
              </button>
            </div>
          </div>

          <label className="mt-4 block">
            <span className="sr-only">{t('knowledge.titleLabel')}</span>
            <input
              {...register('title')}
              data-invalid={!!errors.title}
              placeholder={t('knowledge.titlePlaceholder')}
              className="w-full border-b border-line bg-transparent pb-2 text-[26px] font-semibold leading-[34px] tracking-[-0.6px] text-text outline-none placeholder:text-dim focus:border-info data-[invalid=true]:border-danger"
            />
          </label>
          {error(errors.title?.message)}

          <div className="mt-5 grid grid-cols-[260px_minmax(0,1fr)] gap-[14px]">
            <div>
              <span id="kb-section-label" className={label}>
                {t('knowledge.section')}
              </span>
              <Controller
                control={control}
                name="sectionId"
                render={({ field }) => (
                  <Select.Root
                    value={field.value}
                    onValueChange={(v) =>
                      v === NEW_SECTION ? setSectionDialog(true) : field.onChange(v)
                    }
                  >
                    <Select.Trigger
                      aria-labelledby="kb-section-label"
                      data-invalid={!!errors.sectionId}
                      className={`${fieldBox} mt-[6px] flex h-[42px] items-center gap-2`}
                    >
                      <Select.Value placeholder={t('knowledge.selectSection')} />
                      <ChevronSmallIcon size={14} className="ml-auto text-faint" />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        sideOffset={6}
                        className="z-[60] max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
                      >
                        <Select.Viewport>
                          <Select.Item
                            value={NEW_SECTION}
                            className="flex h-[34px] cursor-pointer items-center gap-2 rounded-[7px] px-3 text-[12px] font-medium text-info outline-none data-[highlighted]:bg-popover-active"
                          >
                            <PlusSmallIcon size={12} />
                            <Select.ItemText>{t('knowledge.newSection')}</Select.ItemText>
                          </Select.Item>
                          <Select.Separator className="mx-1 my-[5px] h-px bg-line" />
                          {open.map((s) => (
                            <Select.Item
                              key={s.id}
                              value={s.id}
                              className="flex h-[34px] cursor-pointer items-center gap-2 rounded-[7px] px-3 text-[12px] text-sub outline-none data-[highlighted]:bg-popover-active data-[state=checked]:bg-popover-active data-[highlighted]:text-text data-[state=checked]:text-text"
                            >
                              <Select.ItemText>{s.name}</Select.ItemText>
                              <Select.ItemIndicator className="ml-auto text-brand-gold">
                                <CheckIcon size={14} />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                )}
              />
              {error(errors.sectionId?.message)}
              <SectionDialog
                open={sectionDialog}
                onClose={() => setSectionDialog(false)}
                onCreated={(s) => {
                  setCreated((c) => [...c, s]);
                  setValue('sectionId', s.id, { shouldDirty: true, shouldValidate: true });
                }}
              />
            </div>
            <label>
              <span className="flex justify-between">
                <span className={label}>{t('knowledge.summary')}</span>
                <span
                  className={`text-[10.5px] ${
                    (values.summary?.trim().length ?? 0) > SUMMARY_MAX ? 'text-danger' : 'text-dim'
                  }`}
                >
                  {values.summary?.trim().length ?? 0} / {SUMMARY_MAX}
                </span>
              </span>
              <textarea
                {...register('summary')}
                rows={2}
                data-invalid={!!errors.summary}
                placeholder={t('knowledge.summaryHint')}
                className={`${fieldBox} mt-[6px] resize-none py-[10px] leading-[18px]`}
              />
              {error(errors.summary?.message)}
            </label>
          </div>

          <hr className="mt-5 border-line" />
          <h3 className={`${capsTitle} mt-5`}>{t('knowledge.body')}</h3>
          <ol className="mt-3 flex flex-col gap-3">
            {blocks.fields.map((field, i) => (
              <BlockEditor
                key={field.id}
                index={i}
                kind={field.kind}
                count={blocks.fields.length}
                register={register}
                invalid={!!errors.blocks?.[i]}
                onMove={(to) => blocks.move(i, to)}
                onRemove={() => blocks.remove(i)}
              />
            ))}
          </ol>
          {error(errors.blocks?.root?.message ?? errors.blocks?.message)}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] text-faint">{t('knowledge.addBlock')}</span>
            {blockKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => blocks.append(emptyBlock(kind))}
                className="flex h-7 items-center gap-1 rounded-[7px] border border-line px-[10px] text-[11.5px] font-medium text-sub hover:border-info-line hover:text-text"
              >
                <PlusSmallIcon size={12} />
                {t(`knowledge.block.${kind}`)}
              </button>
            ))}
          </div>

          <hr className="mt-6 border-line" />
          <Attachments
            value={(values.attachments ?? []) as KbAttachment[]}
            onChange={(list) => setValue('attachments', list, { shouldDirty: true })}
          />
          <div className="mt-6 grid grid-cols-2 gap-[14px]">
            <RelatedTasksField
              value={(values.relatedTasks ?? []) as KbRelatedTask[]}
              onChange={(list) => setValue('relatedTasks', list, { shouldDirty: true })}
            />
            <RelatedDocumentsField
              value={(values.relatedDocuments ?? []) as KbRelatedDocument[]}
              onChange={(list) => setValue('relatedDocuments', list, { shouldDirty: true })}
            />
          </div>

          {editing && (
            <label className="mt-6 block">
              <span className={label}>{t('knowledge.change')}</span>
              <input
                {...register('change')}
                data-invalid={!!errors.change}
                placeholder={t('knowledge.changePlaceholder')}
                className={`${fieldBox} mt-[6px] h-[42px]`}
              />
              <span className="mt-1 block text-[10.5px] text-dim">{t('knowledge.changeHint')}</span>
              {error(errors.change?.message)}
            </label>
          )}
        </section>

        <aside className="sticky top-0 w-[332px] shrink-0 rounded-14 border border-line bg-panel px-[13px] pb-6 pt-[23px]">
          <h2 className={`${capsTitle} px-[6px]`}>{t('knowledge.toc')}</h2>
          {toc.length > 0 ? (
            <ul className="mt-[10px]">
              {toc.map((b, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: превью содержания, без состояния
                  key={i}
                  className="px-3 py-[7px] text-[11.5px] tracking-[-0.1px] text-sub"
                >
                  {b.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-[10px] px-[6px] text-[11px] leading-4 text-dim">
              {t('knowledge.tocHint')}
            </p>
          )}
          <hr className="mx-[6px] mb-[17px] mt-[14px] border-line" />
          <h2 className={`${capsTitle} px-[6px]`}>{t('knowledge.history')}</h2>
          <p className="mt-[10px] px-[6px] text-[11px] font-medium tracking-[-0.1px] text-sub">
            {t('knowledge.versionNext', { number: (article?.version ?? 0) + 1 })}
          </p>
          <p className="mt-[2px] px-[6px] text-[10.5px] text-dim">
            {editing ? t('knowledge.changeHint') : t('knowledge.firstVersionHint')}
          </p>
        </aside>
      </div>
    </form>
  );
}

function BlockEditor({
  index,
  kind,
  count,
  register,
  invalid,
  onMove,
  onRemove,
}: {
  index: number;
  kind: BlockKind;
  count: number;
  register: ReturnType<typeof useForm<FormValues>>['register'];
  invalid: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const name = t(`knowledge.block.${kind}`);
  const iconButton =
    'flex size-6 items-center justify-center rounded-6 text-faint hover:bg-row-highlight hover:text-text disabled:pointer-events-none disabled:opacity-30';
  const input = `${fieldBox} bg-panel`;

  return (
    <li
      data-invalid={invalid}
      className="rounded-9 border border-line bg-surface p-3 data-[invalid=true]:border-danger"
    >
      <div className="flex items-center gap-1">
        <span className={`${capsTitle} flex-1`}>{name}</span>
        <Tooltip content={t('knowledge.moveUp')}>
          <button
            type="button"
            aria-label={`${t('knowledge.moveUp')}: ${name} ${index + 1}`}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
            className={iconButton}
          >
            <ChevronDownIcon size={13} className="rotate-180" />
          </button>
        </Tooltip>
        <Tooltip content={t('knowledge.moveDown')}>
          <button
            type="button"
            aria-label={`${t('knowledge.moveDown')}: ${name} ${index + 1}`}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
            className={iconButton}
          >
            <ChevronDownIcon size={13} />
          </button>
        </Tooltip>
        <Tooltip content={t('knowledge.removeBlock')}>
          <button
            type="button"
            aria-label={`${t('knowledge.removeBlock')}: ${name} ${index + 1}`}
            onClick={onRemove}
            className={iconButton}
          >
            <XIcon size={14} />
          </button>
        </Tooltip>
      </div>

      {kind === 'heading' && (
        <input
          {...register(`blocks.${index}.text`)}
          aria-label={name}
          placeholder={t('knowledge.headingPlaceholder')}
          className={`${input} mt-2 h-10 text-[15px] font-semibold tracking-[-0.2px]`}
        />
      )}
      {kind === 'paragraph' && (
        <textarea
          {...register(`blocks.${index}.text`)}
          aria-label={name}
          rows={3}
          placeholder={t('knowledge.paragraphPlaceholder')}
          className={`${input} mt-2 resize-y py-[10px] text-[13px] leading-[22px]`}
        />
      )}
      {kind === 'list' && (
        <>
          <textarea
            {...register(`blocks.${index}.text`)}
            aria-label={name}
            rows={3}
            placeholder={t('knowledge.listHint')}
            className={`${input} mt-2 resize-y py-[10px] text-[13px] leading-[22px]`}
          />
          <p className="mt-1 text-[10.5px] text-dim">{t('knowledge.listHint')}</p>
        </>
      )}
      {kind === 'note' && (
        <>
          <input
            {...register(`blocks.${index}.title`)}
            aria-label={t('knowledge.noteTitle')}
            placeholder={t('knowledge.noteTitle')}
            className={`${input} mt-2 h-10 font-semibold`}
          />
          <textarea
            {...register(`blocks.${index}.text`)}
            aria-label={t('knowledge.noteText')}
            rows={2}
            placeholder={t('knowledge.noteText')}
            className={`${input} mt-2 resize-y py-[10px] leading-[18px]`}
          />
        </>
      )}
      {invalid && <p className="mt-1 text-[11px] text-danger">{t('knowledge.errorBlock')}</p>}
    </li>
  );
}

const removeButton =
  'flex size-6 shrink-0 items-center justify-center rounded-6 text-faint hover:bg-row-highlight hover:text-text';
const linkRow =
  'flex min-h-10 items-center gap-[9px] rounded-8 border border-line bg-surface py-[7px] pl-[13px] pr-2';

/** Вложения: перетащить или выбрать файлы. Пока бэкенда нет, хранятся только имена */
function Attachments({
  value,
  onChange,
}: {
  value: KbAttachment[];
  onChange: (list: KbAttachment[]) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const add = (files: FileList | null) =>
    files && files.length > 0 && onChange([...value, ...Array.from(files, toAttachment)]);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    add(e.dataTransfer.files);
  };

  return (
    <div className="mt-5">
      <h3 className={capsTitle}>{t('knowledge.attachments')}</h3>
      {value.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {value.map((f) => (
            <li key={f.id} className={linkRow}>
              <AttachLargeIcon size={17} className="shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-sub">{f.name}</span>
              <span className="text-[10.5px] tracking-[0.3px] text-dim">{f.ext}</span>
              <Tooltip content={t('knowledge.removeAttachment')}>
                <button
                  type="button"
                  aria-label={`${t('knowledge.removeAttachment')}: ${f.name}`}
                  onClick={() => onChange(value.filter((a) => a.id !== f.id))}
                  className={removeButton}
                >
                  <XIcon size={14} />
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="mt-3 flex h-11 w-full items-center gap-[7px] rounded-8 border border-dashed border-line px-[13px] text-left text-[12px] text-dim hover:border-info hover:text-sub"
      >
        <AttachLargeIcon size={17} className="shrink-0" />
        {t('knowledge.attachHint')}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label={t('knowledge.attachHint')}
        onChange={(e) => {
          add(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Выпадающий список «связать…»: выбор добавляет пункт, поле снова пустое */
function LinkPicker({
  placeholder,
  empty,
  options,
  onPick,
}: {
  placeholder: string;
  empty: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
}) {
  return (
    <Select.Root value="" onValueChange={onPick} disabled={options.length === 0}>
      <Select.Trigger
        aria-label={placeholder}
        className={`${fieldBox} mt-2 flex h-10 items-center gap-2 text-sub disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <PlusSmallIcon size={12} className="shrink-0" />
        <Select.Value placeholder={options.length > 0 ? placeholder : empty} />
        <ChevronSmallIcon size={14} className="ml-auto text-faint" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[60] max-h-72 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        >
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="flex min-h-[34px] cursor-pointer items-center rounded-[7px] px-3 py-[6px] text-[12px] text-sub outline-none data-[highlighted]:bg-popover-active data-[highlighted]:text-text"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

function RelatedTasksField({
  value,
  onChange,
}: {
  value: KbRelatedTask[];
  onChange: (list: KbRelatedTask[]) => void;
}) {
  const { t } = useTranslation();
  const tasks = useTasks('department');
  const linked = new Set(value.map((r) => r.id));
  const options = (tasks.data ?? [])
    .filter((task) => !linked.has(task.id))
    .map((task) => ({ value: task.id, label: task.title }));

  return (
    <div>
      <h3 className={capsTitle}>{t('knowledge.relatedTasks')}</h3>
      {value.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {value.map((task, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: у задачи без доступа нет ID
            <li key={`${task.id}-${i}`} className={linkRow}>
              <TasksSmallIcon size={14} className="shrink-0 text-info" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-text">{task.title}</span>
                <span className="block text-[10.5px] text-dim">
                  {t(`tasks.status.${task.status}`)}
                </span>
              </span>
              <Tooltip content={t('knowledge.unlink')}>
                <button
                  type="button"
                  aria-label={`${t('knowledge.unlink')}: ${task.title}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className={removeButton}
                >
                  <XIcon size={14} />
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      <LinkPicker
        placeholder={t('knowledge.linkTask')}
        empty={t('knowledge.nothingToLink')}
        options={options}
        onPick={(id) => {
          const task = tasks.data?.find((x) => x.id === id);
          if (task) onChange([...value, { id: task.id, title: task.title, status: task.status }]);
        }}
      />
    </div>
  );
}

function RelatedDocumentsField({
  value,
  onChange,
}: {
  value: KbRelatedDocument[];
  onChange: (list: KbRelatedDocument[]) => void;
}) {
  const { t } = useTranslation();
  const documents = useLinkableDocuments();
  const pool = documents.data ?? [];
  const options = pool
    .map((doc, i) => ({ doc, value: String(i) }))
    .filter(({ doc }) => !value.some((v) => sameDocument(v, doc)))
    .map(({ doc, value: v }) => ({ value: v, label: `${doc.number} — ${doc.title}` }));

  return (
    <div>
      <h3 className={capsTitle}>{t('knowledge.relatedDocuments', { count: 2 })}</h3>
      {value.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {value.map((doc, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: номера документов в заглушке повторяются
            <li key={i} className={linkRow}>
              <DocSmallIcon size={14} className="shrink-0 text-faint" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-text">{doc.number}</span>
                <span className="block truncate text-[10.5px] text-dim">{doc.title}</span>
              </span>
              <Tooltip content={t('knowledge.unlink')}>
                <button
                  type="button"
                  aria-label={`${t('knowledge.unlink')}: ${doc.number}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className={removeButton}
                >
                  <XIcon size={14} />
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      <LinkPicker
        placeholder={t('knowledge.linkDocument')}
        empty={t('knowledge.nothingToLink')}
        options={options}
        onPick={(i) => {
          const doc = pool[Number(i)];
          if (doc) onChange([...value, doc]);
        }}
      />
    </div>
  );
}
