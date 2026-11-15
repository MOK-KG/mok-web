import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { useCan } from '@/features/auth';
import { FieldError, fieldBox, primaryButton, secondaryButton } from '@/features/documents/parts';
import { errorMessageKey, knownErrorCodes } from '@/shared/api/errors';
import { type Tone, toneNames } from '@/shared/config/tokens';
import { ChevronLeftIcon, EditIcon, PlusIcon } from '@/shared/ui/icons';
import {
  type ManagedProject,
  useCreateProject,
  useProjects,
  useTasks,
  useUpdateProject,
} from '../api';
import { toneClasses } from '../ui';

function TonePicker({
  value,
  onChange,
  label,
}: {
  value: Tone;
  onChange: (tone: Tone) => void;
  label: string;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-[6px]">
      <legend className="sr-only">{label}</legend>
      {toneNames.map((tone) => (
        <label
          key={tone}
          className={`flex size-6 cursor-pointer items-center justify-center rounded-full border ${
            tone === value ? 'border-text' : 'border-transparent hover:border-line'
          }`}
        >
          <input
            type="radio"
            name={label}
            value={tone}
            checked={tone === value}
            onChange={() => onChange(tone)}
            aria-label={tone}
            className="sr-only"
          />
          <span aria-hidden className={`size-[14px] rounded-full ${toneClasses[tone].dot}`} />
        </label>
      ))}
    </fieldset>
  );
}

function NewProjectForm() {
  const { t } = useTranslation();
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [tone, setTone] = useState<Tone>('blue');
  const [tried, setTried] = useState(false);
  const clean = name.trim();
  const error = tried && !clean ? t('projects.errorName') : null;
  const serverError = create.error ? t(errorMessageKey(create.error, knownErrorCodes)) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!clean) return;
    create.mutate(
      { name: clean, tone },
      {
        onSuccess: () => {
          setName('');
          setTone('blue');
          setTried(false);
        },
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      aria-label={t('projects.new')}
      className="flex flex-col gap-3 rounded-14 border border-line bg-panel p-[18px]"
    >
      <h2 className="text-[13.5px] font-semibold tracking-[-0.2px] text-text">
        {t('projects.new')}
      </h2>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[220px] flex-1">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (create.isError) create.reset();
            }}
            maxLength={120}
            aria-label={t('projects.namePlaceholder')}
            placeholder={t('projects.namePlaceholder')}
            data-invalid={Boolean(error || serverError)}
            className={fieldBox}
          />
          <FieldError text={error ?? serverError} />
        </div>
        <button type="submit" className={primaryButton} disabled={create.isPending}>
          <PlusIcon size={15} />
          {t('projects.create')}
        </button>
      </div>
      <TonePicker value={tone} onChange={setTone} label={t('projects.color')} />
    </form>
  );
}

function ProjectRow({
  project,
  count,
  canEdit,
}: {
  project: ManagedProject;
  count: number;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const update = useUpdateProject();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [error, setError] = useState<string | null>(null);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError(t('projects.errorName'));
      return;
    }
    if (clean === project.name) {
      setEditing(false);
      return;
    }
    update.mutate(
      { id: project.id, name: clean },
      {
        onSuccess: () => setEditing(false),
        onError: (e) => setError(t(errorMessageKey(e, knownErrorCodes))),
      },
    );
  };

  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line px-[18px] py-3 first:border-t-0">
      <span
        aria-hidden
        className={`size-[10px] shrink-0 rounded-full ${toneClasses[project.tone].dot}`}
      />
      {editing ? (
        <form onSubmit={save} className="flex min-w-[240px] flex-1 flex-wrap items-start gap-2">
          <div className="min-w-[200px] flex-1">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={120}
              aria-label={t('projects.rename')}
              data-invalid={Boolean(error)}
              className={fieldBox}
            />
            <FieldError text={error} />
          </div>
          <button type="submit" className={primaryButton} disabled={update.isPending}>
            {t('projects.save')}
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setEditing(false);
              setName(project.name);
              setError(null);
            }}
          >
            {t('projects.cancel')}
          </button>
        </form>
      ) : (
        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] text-text">{project.name}</p>
          <p className="mt-[3px] text-[11.5px] text-faint">{t('projects.tasks', { count })}</p>
        </div>
      )}
      {canEdit && !editing && (
        <div className="flex flex-wrap items-center gap-3">
          {!project.archived && (
            <TonePicker
              value={project.tone}
              onChange={(tone) => update.mutate({ id: project.id, tone })}
              label={t('projects.colorOf', { name: project.name })}
            />
          )}
          {!project.archived && (
            <button
              type="button"
              aria-label={`${t('projects.rename')}: ${project.name}`}
              onClick={() => setEditing(true)}
              className="flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
            >
              <EditIcon size={15} />
            </button>
          )}
          <button
            type="button"
            className={secondaryButton}
            disabled={update.isPending}
            onClick={() => update.mutate({ id: project.id, archived: !project.archived })}
          >
            {project.archived ? t('projects.restore') : t('projects.archive')}
          </button>
        </div>
      )}
    </li>
  );
}

export function ProjectsPage() {
  const { t } = useTranslation();
  const { can } = useCan();
  const canEdit = can('tasks.assign');
  const projects = useProjects();
  const tasks = useTasks('department').data ?? [];
  usePageSubtitle(t('projects.subtitle'));

  const countOf = (id: string) => tasks.filter((x) => x.project?.id === id).length;
  const list = projects.data ?? [];
  const groups = [
    { key: 'active', items: list.filter((p) => !p.archived) },
    { key: 'archived', items: list.filter((p) => p.archived) },
  ] as const;

  return (
    <div className="flex flex-col gap-3 pb-4 leading-[normal]">
      <Link
        to="/tasks"
        className="flex w-fit items-center gap-1 text-[12.5px] font-medium text-sub hover:text-text"
      >
        <ChevronLeftIcon size={15} />
        {t('sections.tasks')}
      </Link>

      {canEdit ? (
        <NewProjectForm />
      ) : (
        <p className="text-[12.5px] text-faint">{t('projects.readOnly')}</p>
      )}

      {groups.map(({ key, items }) =>
        key === 'archived' && items.length === 0 ? null : (
          <section
            key={key}
            aria-label={t(`projects.${key}`)}
            className="rounded-14 border border-line bg-panel"
          >
            <h2 className="flex items-baseline gap-2 px-[18px] pb-2 pt-4 text-[13.5px] font-semibold tracking-[-0.2px] text-text">
              {t(`projects.${key}`)}
              <span className="text-[11px] font-medium text-dim">{items.length}</span>
            </h2>
            {items.length === 0 ? (
              <p className="px-[18px] pb-4 text-[12.5px] text-dim">
                {projects.isPending ? '' : t('projects.empty')}
              </p>
            ) : (
              <ul className="pb-[6px]">
                {items.map((p) => (
                  <ProjectRow key={p.id} project={p} count={countOf(p.id)} canEdit={canEdit} />
                ))}
              </ul>
            )}
          </section>
        ),
      )}
    </div>
  );
}
