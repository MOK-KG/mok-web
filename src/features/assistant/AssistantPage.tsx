import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import {
  capsTitle,
  FieldError,
  fieldBox,
  label,
  primaryButton,
  secondaryButton,
} from '@/features/documents/parts';
import { ApiError } from '@/shared/api/client';
import { errorText } from '@/shared/api/feedback';
import { roleCodes } from '@/shared/config/permissions';
import { formatInBishkek, formatIsoDate } from '@/shared/lib/date';
import { toast } from '@/shared/lib/toast';
import {
  BoltIcon,
  BookIcon,
  ChevronLeftIcon,
  LockIcon,
  MailIcon,
  PlusIcon,
  SparkleIcon,
} from '@/shared/ui/icons';
import {
  type AgentRun,
  type AssistantSettings,
  type AssistantSettingsInput,
  connectMailbox,
  type DryRunSuggestion,
  type Mailbox,
  mailboxConnectResult,
  useAgentRuns,
  useAssistantSettings,
  useDisconnectMailbox,
  useDryRunAgent,
  useMailboxes,
  useRunAgentNow,
  useSaveAssistantSettings,
  useUpdateMailbox,
} from './api';

type Form = Required<AssistantSettingsInput>;

const toForm = (s: AssistantSettings): Form => ({
  enabled: s.enabled,
  model: s.model,
  instructions: s.instructions,
  pollMinutes: s.pollMinutes,
  knowledgeRoles: s.knowledgeRoles,
  maxLetters: s.maxLetters,
});

/**
 * «Настройки ИИ» (право assistant.manage) — внутри «Ролей и доступа»: агент почты, который
 * разбирает входящие письма и предлагает задачи по базе знаний. Задачу создаёт только человек
 * в очереди писем. Ключ OpenAI задаётся в окружении сервера — здесь только признак, что он
 * задан. Ящики Gmail подключаются через Google (только чтение), список — `MailboxesCard`.
 */
export function AssistantPage() {
  const { t } = useTranslation();
  const settings = useAssistantSettings();
  useMailboxConnectToast();
  usePageSubtitle(
    settings.data
      ? t(settings.data.enabled ? 'assistant.statusOn' : 'assistant.statusOff')
      : undefined,
  );

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-3 leading-[normal]">
      <Link
        to="/access"
        className="flex items-center gap-[6px] self-start text-[12.5px] text-sub hover:text-text"
      >
        <ChevronLeftIcon size={16} />
        {t('sections.access')}
      </Link>
      {settings.isError ? (
        <p className="rounded-14 border border-line bg-panel px-6 py-12 text-center text-[12.5px] text-dim">
          {errorText(settings.error, t)}
        </p>
      ) : !settings.data ? null : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-wrap items-start gap-3">
            <SettingsForm key={settings.data.updatedAt} settings={settings.data} />
            <div className="flex min-w-[320px] flex-1 flex-col gap-3">
              <MailboxesCard />
              <RunCard enabled={settings.data.enabled} />
              <DryRunCard openaiKey={settings.data.environment.openaiKey} />
            </div>
          </div>
          <RunsTable />
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`rounded-14 border border-line bg-panel px-5 pb-5 pt-4 ${className}`}
    >
      <h2 className={`mb-3 flex items-center gap-2 ${capsTitle}`}>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Switch({
  checked,
  onChange,
  text,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  text: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-[10px] rounded-9 border border-line px-3 py-[9px] hover:bg-row-highlight">
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-text">{text}</span>
        {hint && <span className="block text-[10.5px] text-dim">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-info ${
          checked ? 'bg-info' : 'bg-chip'
        }`}
      >
        <span
          className={`absolute top-[2px] size-4 rounded-full bg-[#FFFFFF] transition-[left] ${
            checked ? 'left-[18px]' : 'left-[2px]'
          }`}
        />
      </span>
    </label>
  );
}

function Field({
  id,
  text,
  error,
  children,
  className = '',
}: {
  id: string;
  text: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={`mb-[6px] block ${label}`}>
        {text}
      </label>
      {children}
      <FieldError text={error} />
    </div>
  );
}

/** Признак «задано в окружении сервера» — сам секрет сюда не приходит */
function EnvBadge({
  ok,
  okText,
  missingText,
}: {
  ok: boolean;
  okText: string;
  missingText: string;
}) {
  return (
    <p
      role="status"
      className={`flex items-center gap-2 text-[11.5px] ${ok ? 'text-success' : 'text-warning-text'}`}
    >
      <LockIcon size={14} />
      {ok ? okText : missingText}
    </p>
  );
}

function SettingsForm({ settings }: { settings: AssistantSettings }) {
  const { t } = useTranslation();
  const save = useSaveAssistantSettings();
  const [form, setForm] = useState<Form>(() => toForm(settings));
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const fieldErrors = save.error instanceof ApiError ? (save.error.fields ?? {}) : {};
  const fieldError = (key: keyof Form) => (fieldErrors[key] ? t('assistant.invalid') : null);
  const env = settings.environment;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };

  const toggleRole = (code: (typeof roleCodes)[number]) =>
    set(
      'knowledgeRoles',
      form.knowledgeRoles.includes(code)
        ? form.knowledgeRoles.filter((r) => r !== code)
        : [...form.knowledgeRoles, code].sort(),
    );

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={t('assistant.settingsTitle')}
      className="flex min-w-[420px] flex-[1.3] flex-col gap-3"
    >
      <Card title={t('assistant.agentTitle')} icon={<SparkleIcon size={14} />}>
        <div className="flex flex-col gap-3">
          <Switch
            checked={form.enabled}
            onChange={(v) => set('enabled', v)}
            text={t('assistant.enabled')}
            hint={t('assistant.enabledHint')}
          />
          <EnvBadge
            ok={env.openaiKey}
            okText={t('assistant.openaiKeySet')}
            missingText={t('assistant.openaiKeyMissing')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field id="assistant-model" text={t('assistant.model')} error={fieldError('model')}>
              <input
                id="assistant-model"
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                placeholder={t('assistant.modelDefault', { model: env.defaultModel })}
                className={fieldBox}
              />
            </Field>
            <Field
              id="assistant-poll"
              text={t('assistant.pollMinutes')}
              error={fieldError('pollMinutes')}
            >
              <input
                id="assistant-poll"
                type="number"
                min={1}
                max={1440}
                value={form.pollMinutes}
                onChange={(e) => set('pollMinutes', Number(e.target.value))}
                className={fieldBox}
              />
            </Field>
            <Field
              id="assistant-max"
              text={t('assistant.maxLetters')}
              error={fieldError('maxLetters')}
            >
              <input
                id="assistant-max"
                type="number"
                min={1}
                max={100}
                value={form.maxLetters}
                onChange={(e) => set('maxLetters', Number(e.target.value))}
                className={fieldBox}
              />
            </Field>
          </div>
          <Field
            id="assistant-instructions"
            text={t('assistant.instructions')}
            error={fieldError('instructions')}
          >
            <textarea
              id="assistant-instructions"
              rows={6}
              value={form.instructions}
              onChange={(e) => set('instructions', e.target.value)}
              placeholder={t('assistant.instructionsHint')}
              className={`${fieldBox} py-[10px]`}
            />
          </Field>
        </div>
      </Card>

      <Card title={t('assistant.knowledgeTitle')} icon={<BookIcon size={14} />}>
        <fieldset>
          <legend className="mb-2 text-[11.5px] text-dim">{t('assistant.knowledgeHint')}</legend>
          <div className="flex flex-wrap gap-[6px]">
            {roleCodes.map((code) => {
              const on = form.knowledgeRoles.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleRole(code)}
                  className={`flex h-7 items-center gap-[6px] rounded-8 border px-[10px] text-[12px] ${
                    on
                      ? 'border-transparent bg-control-active font-semibold text-text'
                      : 'border-line text-sub hover:text-text'
                  }`}
                >
                  <span className="text-[10.5px] text-dim">{code}</span>
                  {t(`access.roles.${code}`)}
                </button>
              );
            })}
          </div>
          <FieldError text={fieldError('knowledgeRoles')} />
        </fieldset>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {save.isError && !Object.keys(fieldErrors).length && (
          <p role="alert" className="text-[11.5px] text-danger">
            {errorText(save.error, t)}
          </p>
        )}
        <button type="submit" disabled={save.isPending} className={primaryButton}>
          {t('assistant.save')}
        </button>
      </div>
    </form>
  );
}

/** Возврат из Google после подключения ящика: тост и убрать ?mailbox=… из адреса */
function useMailboxConnectToast() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const result = mailboxConnectResult(params);
    if (!result) return;
    if (result.status === 'connected') {
      toast.success(t('assistant.mailboxConnected', { email: result.email }));
    } else {
      const reason = `assistant.connectError.${result.reason}`;
      toast.error(t(reason, { defaultValue: t('assistant.connectError.google_error') }));
    }
    const next = new URLSearchParams(params);
    for (const key of ['mailbox', 'email', 'reason']) next.delete(key);
    setParams(next, { replace: true });
  }, [params, setParams, t]);
}

function MailboxesCard() {
  const { t } = useTranslation();
  const mailboxes = useMailboxes();
  const returnTo = `${window.location.origin}/access/assistant`;
  return (
    <Card title={t('assistant.mailboxesTitle')} icon={<MailIcon size={14} />}>
      <p className="mb-3 text-[12px] text-sub">{t('assistant.mailboxesHint')}</p>
      {mailboxes.isError ? (
        <p className="mb-3 text-[12px] text-dim">{errorText(mailboxes.error, t)}</p>
      ) : !mailboxes.data ? null : mailboxes.data.length === 0 ? (
        <p className="mb-3 text-[12px] text-dim">{t('assistant.noMailboxes')}</p>
      ) : (
        <ul aria-label={t('assistant.mailboxesTitle')} className="mb-3 flex flex-col gap-2">
          {mailboxes.data.map((m) => (
            <MailboxRow key={`${m.id}-${m.label}-${m.enabled}`} mailbox={m} returnTo={returnTo} />
          ))}
        </ul>
      )}
      <button type="button" onClick={() => connectMailbox(returnTo)} className={secondaryButton}>
        <PlusIcon size={15} />
        {t('assistant.connectMailbox')}
      </button>
    </Card>
  );
}

function MailboxRow({ mailbox: m, returnTo }: { mailbox: Mailbox; returnTo: string }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateMailbox();
  const disconnect = useDisconnectMailbox();
  const [labelText, setLabelText] = useState(m.label);
  const [confirming, setConfirming] = useState(false);
  const at = (iso: string) => formatInBishkek(iso, 'd MMM, HH:mm', i18n.language);
  const labelId = `mailbox-label-${m.id}`;

  return (
    <li aria-label={m.email} className="rounded-12 border border-line px-3 py-[10px]">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text">
          {m.email}
        </span>
        <label className="flex items-center gap-[6px] text-[11.5px] text-sub">
          <input
            type="checkbox"
            checked={m.enabled}
            disabled={update.isPending}
            onChange={(e) => update.mutate({ id: m.id, enabled: e.target.checked })}
          />
          {t('assistant.mailboxEnabled')}
        </label>
      </div>
      <p className="mt-1 text-[11px] text-dim">
        {m.checkedAt
          ? t('assistant.mailboxChecked', { at: at(m.checkedAt) })
          : t('assistant.mailboxNotChecked')}
        {m.connectedBy && ` · ${t('assistant.mailboxConnectedBy', { name: m.connectedBy.name })}`}
      </p>
      {m.needsReconnect ? (
        <p role="alert" className="mt-2 text-[11.5px] text-warning-text">
          {t('assistant.mailboxNeedsReconnect')}
        </p>
      ) : (
        m.lastError && (
          <p className="mt-2 text-[11.5px] text-danger" title={m.lastError}>
            {m.lastError}
          </p>
        )
      )}
      <form
        className="mt-2 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ id: m.id, label: labelText.trim() });
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={labelId} className={`mb-[4px] block ${label}`}>
            {t('assistant.mailboxLabel')}
          </label>
          <input
            id={labelId}
            value={labelText}
            onChange={(e) => setLabelText(e.target.value)}
            placeholder="INBOX"
            className={fieldBox}
          />
        </div>
        {labelText.trim() !== m.label && (
          <button type="submit" disabled={update.isPending} className={secondaryButton}>
            {t('assistant.save')}
          </button>
        )}
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => connectMailbox(returnTo, m.email)}
          className="text-[11.5px] text-info hover:underline"
        >
          {t('assistant.reconnectMailbox')}
        </button>
        {confirming ? (
          <>
            <span className="text-[11.5px] text-sub">{t('assistant.disconnectConfirm')}</span>
            <button
              type="button"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(m.id)}
              className="text-[11.5px] font-semibold text-danger hover:underline"
            >
              {t('assistant.disconnectYes')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[11.5px] text-sub hover:underline"
            >
              {t('assistant.cancel')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-[11.5px] text-sub hover:text-danger hover:underline"
          >
            {t('assistant.disconnectMailbox')}
          </button>
        )}
      </div>
    </li>
  );
}

function RunCard({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const run = useRunAgentNow();
  return (
    <Card title={t('assistant.queueTitle')} icon={<BoltIcon size={14} />}>
      <p className="mb-3 text-[12px] text-sub">{t('assistant.queueHint')}</p>
      <button
        type="button"
        disabled={!enabled || run.isPending}
        onClick={() => run.mutate()}
        className={secondaryButton}
      >
        <BoltIcon size={15} />
        {run.isPending ? t('assistant.running') : t('assistant.runNow')}
      </button>
      {!enabled && <p className="mt-2 text-[11.5px] text-dim">{t('assistant.disabledNote')}</p>}
    </Card>
  );
}

function DryRunCard({ openaiKey }: { openaiKey: boolean }) {
  const { t } = useTranslation();
  const dry = useDryRunAgent();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (subject.trim()) dry.mutate({ subject: subject.trim(), body });
  };

  return (
    <Card title={t('assistant.dryRunTitle')} icon={<SparkleIcon size={14} />}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-[12px] text-sub">{t('assistant.dryRunHint')}</p>
        <Field id="dry-subject" text={t('assistant.subject')}>
          <input
            id="dry-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={fieldBox}
          />
        </Field>
        <Field id="dry-body" text={t('assistant.body')}>
          <textarea
            id="dry-body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${fieldBox} py-[10px]`}
          />
        </Field>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!subject.trim() || dry.isPending || !openaiKey}
            className={primaryButton}
          >
            {dry.isPending ? t('assistant.thinking') : t('assistant.dryRun')}
          </button>
          {!openaiKey && <span className="text-[11.5px] text-dim">{t('assistant.needKey')}</span>}
        </div>
        {dry.isError && (
          <p role="alert" className="text-[11.5px] text-danger">
            {errorText(dry.error, t)}
          </p>
        )}
      </form>
      {dry.data && <SuggestionView suggestion={dry.data} />}
    </Card>
  );
}

function SuggestionView({ suggestion: s }: { suggestion: DryRunSuggestion }) {
  const { t, i18n } = useTranslation();
  const flag = (field: keyof DryRunSuggestion['flags']) =>
    s.flags[field] ? (
      <span className="ml-2 rounded-[5px] bg-warning-chip px-[6px] text-[10px] font-medium text-warning-text">
        {t(`assistant.flag.${s.flags[field]}`)}
      </span>
    ) : null;
  const row = (name: string, value: ReactNode, field: keyof DryRunSuggestion['flags']) => (
    <div className="flex gap-3 py-[6px]">
      <dt className="w-[110px] shrink-0 text-[11.5px] text-dim">{name}</dt>
      <dd className="min-w-0 flex-1 text-[12.5px] text-text">
        {value || <span className="text-dim">—</span>}
        {flag(field)}
      </dd>
    </div>
  );
  return (
    <section
      aria-label={t('assistant.result')}
      className="mt-4 rounded-12 border border-line bg-column px-4 py-3"
    >
      <dl className="divide-y divide-line">
        {row(t('assistant.taskTitle'), s.title, 'title')}
        {row(t('taskCard.assignee'), s.assignee?.name, 'assignee')}
        {row(t('taskCard.due'), s.due && formatIsoDate(s.due, undefined, i18n.language), 'due')}
        {row(t('taskCard.project'), s.project?.name, 'project')}
        {row(t('taskCard.priority'), t(`taskCard.priorityValue.${s.priority}`), 'priority')}
      </dl>
      <h3 className={`mt-3 ${capsTitle}`}>{t('assistant.reasoning')}</h3>
      <p className="mt-1 whitespace-pre-line text-[12.5px] text-sub">{s.reasoning}</p>
      {s.sources.length > 0 && (
        <>
          <h3 className={`mt-3 ${capsTitle}`}>{t('assistant.sources')}</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {s.sources.map((d) => (
              <li key={d.slug}>
                <Link
                  to={`/knowledge/${d.slug}`}
                  className="flex items-center gap-2 text-[12.5px] text-info hover:underline"
                >
                  <BookIcon size={14} />
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {s.toolCalls.length > 0 && (
        <p className="mt-3 text-[11px] text-dim">
          {t('assistant.toolCalls', {
            list: s.toolCalls.map((c) => t(`assistant.tool.${c.name}`, c.name)).join(' → '),
          })}
        </p>
      )}
    </section>
  );
}

function RunsTable() {
  const { t, i18n } = useTranslation();
  const runs = useAgentRuns();
  const list: AgentRun[] = runs.data ?? [];
  const at = (iso: string) => formatInBishkek(iso, 'd MMM, HH:mm', i18n.language);
  return (
    <section
      aria-label={t('assistant.runsTitle')}
      className="rounded-14 border border-line bg-panel"
    >
      <h2 className={`px-5 pb-2 pt-4 ${capsTitle}`}>{t('assistant.runsTitle')}</h2>
      {runs.isError ? (
        <p className="px-6 py-8 text-center text-[12.5px] text-dim">{errorText(runs.error, t)}</p>
      ) : !runs.data ? null : list.length === 0 ? (
        <p className="px-6 py-8 text-center text-[12.5px] text-dim">{t('assistant.noRuns')}</p>
      ) : (
        <table className="w-full table-fixed text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] font-semibold uppercase tracking-[1px] text-dim">
              <th className="w-[140px] px-5 py-[10px] font-semibold">{t('assistant.col.at')}</th>
              <th className="w-[160px] px-3 py-[10px] font-semibold">
                {t('assistant.col.trigger')}
              </th>
              <th className="w-[100px] px-3 py-[10px] font-semibold">
                {t('assistant.col.fetched')}
              </th>
              <th className="w-[100px] px-3 py-[10px] font-semibold">
                {t('assistant.col.analyzed')}
              </th>
              <th className="w-[90px] px-3 py-[10px] font-semibold">{t('assistant.col.failed')}</th>
              <th className="px-3 py-[10px] font-semibold">{t('assistant.col.error')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-line align-top last:border-b-0">
                <td className="px-5 py-[10px] text-faint">{at(r.startedAt)}</td>
                <td className="px-3 py-[10px] text-sub">
                  {t(`assistant.trigger.${r.trigger}`)}
                  {r.startedBy && (
                    <span className="block text-[11px] text-dim">{r.startedBy.name}</span>
                  )}
                </td>
                <td className="px-3 py-[10px] text-sub">{r.fetched}</td>
                <td className="px-3 py-[10px] text-sub">{r.analyzed}</td>
                <td className={`px-3 py-[10px] ${r.failed ? 'text-danger' : 'text-sub'}`}>
                  {r.failed}
                </td>
                <td className="px-3 py-[10px] text-[11.5px] text-faint">
                  {r.finishedAt ? (
                    <span className="whitespace-pre-line break-words">{r.error}</span>
                  ) : (
                    t('assistant.inProgress')
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
