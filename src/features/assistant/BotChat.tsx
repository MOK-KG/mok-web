import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useTaskLink } from '@/features/tasks/TaskOverlay';
import { errorText } from '@/shared/api/feedback';
import {
  BookIcon,
  ExternalIcon,
  PlusIcon,
  SendIcon,
  SparkleIcon,
  TasksIcon,
} from '@/shared/ui/icons';
import { Markdown } from '@/shared/ui/Markdown';
import { Tooltip } from '@/shared/ui/Tooltip';
import {
  type BotAction,
  type BotMessage,
  type BotSource,
  isThinking,
  useBot,
  useBotConversations,
  useDecideBotAction,
  useNewBotConversation,
  useSendToBot,
} from './bot';

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek',
  });

/** Значок ассистента — в списке чатов и в разговоре */
export function BotAvatar({ size = 32 }: { size?: 30 | 32 }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-info text-[#FFFFFF]"
    >
      <SparkleIcon size={16} />
    </span>
  );
}

/**
 * Личный разговор с ассистентом (справа в «Чате»). Вопрос уходит на сервер, ответ приходит
 * опросом; изменения — карточками, которые сотрудник подтверждает сам. Разговоры — вкладками:
 * «Новый разговор» начинает новый, прежние остаются (открытый — в адресе, ?bc=ID).
 */
export function BotChat() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const asked = Number(params.get('bc')) || null;
  const bot = useBot(asked);
  const conversationId = bot.data?.conversation?.id ?? asked;
  const startNew = useNewBotConversation();
  const messages = bot.data?.messages ?? [];
  const thinking = isThinking(messages);
  const end = useRef<HTMLDivElement>(null);

  const open = (id: number) =>
    setParams(
      (p) => {
        p.set('bc', String(id));
        return p;
      },
      { replace: true },
    );
  const send = useSendToBot();
  const ask = (text: string, onDone?: () => void) =>
    send.mutate(
      { text, conversationId: conversationId ?? undefined },
      {
        onSuccess: (message) => {
          open(message.conversationId);
          onDone?.();
        },
      },
    );

  // biome-ignore lint/correctness/useExhaustiveDependencies: прокрутка к каждому новому сообщению
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, thinking]);

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-3">
        <BotAvatar />
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold tracking-[-0.2px] text-text">
            {t('assistant.bot.title')}
          </h2>
          <p className="truncate text-[11px] text-dim">{t('assistant.bot.subtitle')}</p>
        </div>
        {bot.data?.notesUrl && (
          <Tooltip content={t('assistant.bot.memoryHint')}>
            <Link
              to={bot.data.notesUrl}
              className="flex h-8 items-center gap-[6px] rounded-9 border border-line px-3 text-[12px] text-sub hover:text-text"
            >
              <BookIcon size={14} />
              {t('assistant.bot.memory')}
            </Link>
          </Tooltip>
        )}
        <button
          type="button"
          disabled={startNew.isPending || thinking || messages.length === 0}
          onClick={() => startNew.mutate(undefined, { onSuccess: (c) => open(c.id) })}
          className="flex h-8 items-center gap-[6px] rounded-9 border border-line px-3 text-[12px] text-sub hover:text-text disabled:opacity-40"
        >
          <PlusIcon size={14} />
          {t('assistant.bot.newChat')}
        </button>
      </header>
      <ConversationTabs current={conversationId} onOpen={open} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
        {bot.isError ? (
          <p className="mt-16 text-center text-[12.5px] text-dim">{errorText(bot.error, t)}</p>
        ) : bot.data && !bot.data.available ? (
          <p className="mt-16 text-center text-[12.5px] text-dim">
            {t('assistant.bot.unavailable')}
          </p>
        ) : (
          bot.data &&
          messages.length === 0 && <Welcome busy={send.isPending} onAsk={(text) => ask(text)} />
        )}
        {messages.map((m) => (
          <Fragment key={m.id}>
            <BotMessageView message={m} />
          </Fragment>
        ))}
        {thinking && (
          <p role="status" className="mt-3 flex items-center gap-2 text-[12px] text-dim">
            <BotAvatar size={30} />
            {t('assistant.bot.thinking')}
          </p>
        )}
        <div ref={end} />
      </div>
      <BotComposer
        disabled={thinking || !bot.data?.available}
        busy={send.isPending}
        error={send.error}
        onSend={ask}
      />
    </>
  );
}

/** Вкладки разговоров: новые слева; пустой новый — отдельной вкладкой */
function ConversationTabs({
  current,
  onOpen,
}: {
  current: number | null;
  onOpen: (id: number) => void;
}) {
  const { t } = useTranslation();
  const list = useBotConversations().data ?? [];
  const fresh = current !== null && !list.some((c) => c.id === current);
  if (list.length === 0) return null;
  const tab = (active: boolean) =>
    `h-7 max-w-[200px] shrink-0 truncate rounded-8 px-3 text-[11.5px] ${
      active ? 'bg-control-active font-medium text-text' : 'text-sub hover:text-text'
    }`;
  return (
    <div
      role="tablist"
      aria-label={t('assistant.bot.conversations')}
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-5 py-2"
    >
      {fresh && (
        <button type="button" role="tab" aria-selected className={tab(true)}>
          {t('assistant.bot.newChat')}
        </button>
      )}
      {list.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={c.id === current}
          title={c.title}
          onClick={() => onOpen(c.id)}
          className={tab(c.id === current)}
        >
          {c.title || t('assistant.bot.untitled')}
        </button>
      ))}
    </div>
  );
}

function Welcome({ busy, onAsk }: { busy: boolean; onAsk: (text: string) => void }) {
  const { t } = useTranslation();
  const examples = ['example1', 'example2', 'example3', 'example4'] as const;
  return (
    <div className="mx-auto mt-10 max-w-[460px] text-center">
      <div className="mx-auto w-fit">
        <BotAvatar />
      </div>
      <p className="mt-3 text-[13px] font-medium text-text">{t('assistant.bot.welcome')}</p>
      <p className="mt-1 text-[12px] text-sub">{t('assistant.bot.welcomeHint')}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {examples.map((key) => (
          <li key={key}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAsk(t(`assistant.bot.${key}`))}
              className="w-full rounded-10 border border-line bg-column px-3 py-2 text-left text-[12px] text-sub hover:border-info hover:text-text"
            >
              {t(`assistant.bot.${key}`)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BotMessageView({ message: m }: { message: BotMessage }) {
  const { t } = useTranslation();
  if (m.role === 'action' && m.action) return <ActionCard action={m.action} />;
  if (m.role === 'user') {
    return (
      <div className="mt-3 flex flex-col items-end">
        <p className="max-w-[80%] whitespace-pre-wrap break-words rounded-12 rounded-br-[4px] bg-control-active px-3 py-2 text-[13px] leading-[19px] text-text">
          {m.text}
        </p>
        <time dateTime={m.at} className="mt-1 text-[10px] text-dim">
          {timeOf(m.at)}
        </time>
        {m.status === 'failed' && (
          <p role="alert" className="mt-1 max-w-[80%] text-right text-[11.5px] text-danger">
            {m.error || t('assistant.bot.failed')}
          </p>
        )}
      </div>
    );
  }
  return (
    <article className="mt-3 flex gap-[10px]">
      <BotAvatar />
      <div className="min-w-0 flex-1">
        <div className="break-words">
          <Markdown text={m.text} size="compact" />
        </div>
        {m.sources.length > 0 && <Sources sources={m.sources} />}
        <time dateTime={m.at} className="mt-1 block text-[10px] text-dim">
          {timeOf(m.at)}
          {m.steps.length > 0 && ` · ${t('assistant.bot.steps', { count: m.steps.length })}`}
        </time>
      </div>
    </article>
  );
}

function Sources({ sources }: { sources: BotSource[] }) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t('assistant.bot.sources')} className="mt-2 flex flex-wrap gap-[6px]">
      {sources.map((s) => {
        const icon =
          s.kind === 'article' || s.kind === 'memory' ? (
            <BookIcon size={13} />
          ) : s.kind === 'task' ? (
            <TasksIcon size={13} />
          ) : (
            <ExternalIcon size={13} />
          );
        const cls =
          'flex max-w-[260px] items-center gap-[5px] rounded-8 border border-line px-2 py-[3px] text-[11px] text-sub hover:border-info hover:text-text';
        return (
          <li key={s.url}>
            {s.kind === 'web' ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className={cls}>
                {icon}
                <span className="truncate">{s.title}</span>
              </a>
            ) : (
              <Link to={s.url} className={cls}>
                {icon}
                <span className="truncate">{s.title}</span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ActionCard({ action: a }: { action: BotAction }) {
  const { t } = useTranslation();
  const decide = useDecideBotAction();
  const taskLink = useTaskLink();
  const pending = a.status === 'pending';

  return (
    <section
      aria-label={t(`assistant.bot.kind.${a.kind}`)}
      className={`ml-[42px] mt-3 max-w-[520px] rounded-12 border bg-column px-4 py-3 ${
        pending ? 'border-info' : 'border-line'
      }`}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[1px] text-dim">
        {t(`assistant.bot.kind.${a.kind}`)}
      </p>
      <p className="mt-1 text-[13px] font-medium text-text">{a.preview.title}</p>
      <dl className="mt-2 flex flex-col gap-1">
        {a.preview.fields.map((f) => (
          <div key={f.key} className="flex gap-3 text-[12px]">
            <dt className="w-[100px] shrink-0 text-dim">
              {t(`assistant.bot.field.${f.key}`, { defaultValue: f.key })}
            </dt>
            <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sub">{f.value}</dd>
          </div>
        ))}
      </dl>
      {a.preview.warnings.map((w) => (
        <p key={w} className="mt-2 text-[11.5px] text-warning-text">
          {w}
        </p>
      ))}
      {pending ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: a.id, decision: 'confirm' })}
            className="h-8 rounded-9 bg-brand-red px-4 text-[12px] font-medium text-[#FFFFFF] hover:opacity-90 disabled:opacity-50"
          >
            {t(a.kind === 'message' ? 'assistant.bot.send' : 'assistant.bot.confirm')}
          </button>
          <button
            type="button"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: a.id, decision: 'cancel' })}
            className="h-8 rounded-9 border border-line px-4 text-[12px] text-sub hover:text-text disabled:opacity-50"
          >
            {t('assistant.cancel')}
          </button>
        </div>
      ) : (
        <p
          role="status"
          className={`mt-3 text-[12px] ${
            a.status === 'done'
              ? 'text-success'
              : a.status === 'failed'
                ? 'text-danger'
                : 'text-dim'
          }`}
        >
          {t(`assistant.bot.status.${a.status}`)}
          {a.status === 'failed' && a.error && `: ${a.error}`}
          {a.status === 'done' && a.result.taskId && (
            <>
              {' · '}
              <Link to={taskLink(a.result.taskId)} className="text-info hover:underline">
                {a.result.code}
              </Link>
            </>
          )}
          {a.status === 'done' && a.result.chatId && (
            <>
              {' · '}
              <Link to={`/chat?c=${a.result.chatId}`} className="text-info hover:underline">
                {t('assistant.bot.openChat')}
              </Link>
            </>
          )}
          {a.status === 'done' && a.result.eventId && (
            <>
              {' · '}
              <Link
                to={`/calendar?d=${a.result.date}&m=${a.result.date?.slice(0, 7)}`}
                className="text-info hover:underline"
              >
                {t('assistant.bot.openCalendar')}
              </Link>
              {a.result.googleLink && (
                <>
                  {' · '}
                  <a
                    href={a.result.googleLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline"
                  >
                    Google Calendar
                  </a>
                </>
              )}
            </>
          )}
        </p>
      )}
      {a.status === 'done' && a.result.googleError && (
        <p className="mt-1 text-[11.5px] text-warning-text">
          {t('assistant.bot.googleFailed', { error: a.result.googleError })}
        </p>
      )}
    </section>
  );
}

function BotComposer({
  disabled,
  busy,
  error,
  onSend,
}: {
  disabled: boolean;
  busy: boolean;
  error: Error | null;
  onSend: (text: string, onDone: () => void) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');

  const submit = () => {
    const clean = text.trim();
    if (!clean || disabled || busy) return;
    onSend(clean, () => setText(''));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 px-5 pb-[10px]">
      <div className="flex items-end gap-[6px] rounded-11 border border-line bg-column py-[10px] pl-4 pr-[10px] focus-within:border-info">
        <textarea
          aria-label={t('assistant.bot.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={4000}
          rows={1}
          placeholder={t('assistant.bot.placeholder')}
          className="max-h-32 min-h-7 w-full resize-none bg-transparent py-[5px] text-[13px] leading-[18px] text-text outline-none placeholder:text-dim [field-sizing:content]"
        />
        <Tooltip content={t('chat.send')}>
          <button
            type="button"
            aria-label={t('chat.send')}
            disabled={!text.trim() || disabled || busy}
            onClick={submit}
            className="flex size-7 items-center justify-center rounded-6 text-info hover:bg-row-highlight disabled:opacity-40"
          >
            <SendIcon size={16} />
          </button>
        </Tooltip>
      </div>
      {error ? (
        <p role="alert" className="mt-[6px] text-[10.5px] text-danger">
          {errorText(error, t)}
        </p>
      ) : (
        <p className="mt-[6px] text-[10.5px] text-dim">{t('assistant.bot.hint')}</p>
      )}
    </div>
  );
}
