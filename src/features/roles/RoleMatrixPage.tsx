import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { useCan } from '@/features/auth';
import { type Permission, permissions } from '@/shared/config/permissions';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { CheckIcon, ChevronLeftIcon } from '@/shared/ui/icons';
import { type RoleInfo, useRoleMatrix, useSaveRolePermissions } from './api';
import { RoleCodeChip } from './parts';

const groupOf = (permission: Permission) => permission.split('.')[0];

const cellKey = (code: string, permission: Permission) => `${code}|${permission}`;

const groupTitle: Record<string, string> = {
  tasks: 'sections.tasks',
  documents: 'sections.documents',
  knowledge: 'sections.knowledge',
  chat: 'sections.chat',
  calendar: 'sections.calendar',
  files: 'sections.files',
  staff: 'sections.access',
  roles: 'sections.access',
  journal: 'journal.title',
  assistant: 'assistant.title',
  absences: 'absences.title',
};

export function RoleMatrixPage() {
  const { t } = useTranslation();
  const matrix = useRoleMatrix();
  const { can } = useCan();
  const save = useSaveRolePermissions();
  const [toggled, setToggled] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  usePageSubtitle(t('access.matrixSubtitle'));
  const roles = matrix.data ?? [];
  const editable = can('roles.assign') && roles.length > 0;
  const has = (role: RoleInfo, permission: Permission) =>
    role.permissions.includes(permission) !== toggled.has(cellKey(role.code, permission));
  const toggle = (role: RoleInfo, permission: Permission) =>
    setToggled((prev) => {
      const next = new Set(prev);
      const key = cellKey(role.code, permission);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const changed = roles.filter((role) =>
    permissions.some((p) => toggled.has(cellKey(role.code, p))),
  );
  const permName = (permission: Permission) => t(`access.permissionNames.${permission}`);

  const rows: { group: string | null; permission: Permission }[] = [];
  let previous = '';
  for (const permission of permissions) {
    const title = t(groupTitle[groupOf(permission)] ?? 'access.permission');
    rows.push({ group: title === previous ? null : title, permission });
    previous = title;
  }

  return (
    <div className="flex flex-col gap-3 pb-4 leading-[normal]">
      <Link
        to="/access"
        className="flex w-fit items-center gap-1 text-[12.5px] font-medium text-sub hover:text-text"
      >
        <ChevronLeftIcon size={15} />
        {t('sections.access')}
      </Link>

      {editable && <p className="text-[12px] text-dim">{t('access.matrixEditHint')}</p>}

      {matrix.data === null ? (
        <p className="rounded-14 border border-line bg-panel px-4 py-6 text-[12.5px] text-dim">
          {t('access.matrixUnavailable')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-14 border border-line bg-panel">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 bg-panel px-4 py-3 text-[11px] font-medium text-dim">
                  {t('access.permission')}
                </th>
                {roles.map((role) => (
                  <th key={role.code} className="px-2 py-3 text-center align-bottom">
                    <span className="flex flex-col items-center gap-1">
                      <RoleCodeChip role={role.code} />
                      <span className="text-[10px] font-medium leading-3 text-dim">
                        {role.name}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ group, permission }) => [
                group && (
                  <tr key={`g-${permission}`} className="border-t border-line bg-column">
                    <th
                      colSpan={roles.length + 1}
                      className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[1.2px] text-dim"
                    >
                      {group}
                    </th>
                  </tr>
                ),
                <tr key={permission} className="border-t border-line">
                  <th className="sticky left-0 bg-panel px-4 py-[9px] text-[12px] font-normal text-text">
                    {t(`access.permissionNames.${permission}`)}
                  </th>
                  {roles.map((role) => {
                    const on = has(role, permission);
                    const label = `${role.code} · ${permName(permission)}: ${on ? '+' : '—'}`;
                    const mark = on ? (
                      <CheckIcon size={14} className="mx-auto text-success" />
                    ) : (
                      <span className="text-dim">—</span>
                    );
                    if (!editable) {
                      return (
                        <td key={role.code} aria-label={label} className="px-2 text-center">
                          {mark}
                        </td>
                      );
                    }
                    const dirty = toggled.has(cellKey(role.code, permission));
                    return (
                      <td key={role.code} className="px-1 py-[3px] text-center">
                        <button
                          type="button"
                          aria-label={label}
                          aria-pressed={on}
                          onClick={() => toggle(role, permission)}
                          className={`flex h-7 w-full items-center justify-center rounded-[7px] hover:bg-row-highlight ${
                            dirty ? 'bg-info-chip ring-1 ring-info-line' : ''
                          }`}
                        >
                          {mark}
                        </button>
                      </td>
                    );
                  })}
                </tr>,
              ])}
            </tbody>
          </table>
        </div>
      )}

      {toggled.size > 0 && (
        <div className="sticky bottom-3 flex items-center gap-3 rounded-14 border border-line bg-panel px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <span className="flex-1 text-[12.5px] text-text">
            {t('access.matrixChanges', { count: toggled.size })}
          </span>
          <button
            type="button"
            onClick={() => setToggled(new Set())}
            className="h-9 rounded-9 border border-line px-4 text-[12.5px] font-medium text-sub hover:text-text"
          >
            {t('access.matrixReset')}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-9 rounded-9 bg-brand-red px-4 text-[12.5px] font-semibold text-[#FFFFFF] hover:opacity-90"
          >
            {t('access.matrixSave')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title={t('access.matrixConfirmTitle')}
        confirmLabel={t('access.matrixSave')}
        cancelLabel={t('access.cancel')}
        pending={save.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          save.mutate(
            changed.map((role) => ({
              code: role.code,
              permissions: permissions.filter((p) => has(role, p)),
            })),
            {
              onSuccess: () => setToggled(new Set()),
              onSettled: () => setConfirming(false),
            },
          )
        }
      >
        <p>{t('access.matrixConfirmText')}</p>
        <ul className="mt-3 flex flex-col gap-1">
          {changed.map((role) => (
            <li key={role.code} className="text-[12px] text-text">
              <span className="font-semibold">{role.code}</span>{' '}
              {permissions
                .filter((p) => toggled.has(cellKey(role.code, p)))
                .map(
                  (p) =>
                    `${has(role, p) ? t('access.matrixGrant') : t('access.matrixRevoke')} «${permName(p)}»`,
                )
                .join(', ')}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
