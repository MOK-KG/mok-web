import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { type Permission, permissions } from '@/shared/config/permissions';
import { CheckIcon, ChevronLeftIcon } from '@/shared/ui/icons';
import { useRoleMatrix } from './api';
import { RoleCodeChip } from './parts';

const groupOf = (permission: Permission) => permission.split('.')[0];

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
};

export function RoleMatrixPage() {
  const { t } = useTranslation();
  const matrix = useRoleMatrix();
  usePageSubtitle(t('access.matrixSubtitle'));
  const roles = matrix.data ?? [];

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
                    const has = role.permissions.includes(permission);
                    return (
                      <td
                        key={role.code}
                        aria-label={`${role.code} · ${t(`access.permissionNames.${permission}`)}: ${
                          has ? '+' : '—'
                        }`}
                        className="px-2 text-center"
                      >
                        {has ? (
                          <CheckIcon size={14} className="mx-auto text-success" />
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>,
              ])}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
