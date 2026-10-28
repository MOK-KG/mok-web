import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePageSubtitle } from '@/app/layout/AppLayout';
import { Can } from '@/features/auth';
import { type RoleCode, roleCodes } from '@/shared/config/permissions';
import { toast } from '@/shared/lib/toast';
import {
  ArrowRightIcon,
  CheckboxCheckIcon,
  FilterIcon,
  MailMediumIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
} from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import { type StaffRow, useStaff } from './api';
import { InviteDialog } from './InviteDialog';
import { RoleCodeChip, StaffAvatar, StatusBadge } from './parts';
import type { StaffBadge } from './types';
import { UserCard } from './UserCard';

/** Сколько строк видно до «Показать все» — как в макете */
const PREVIEW = 9;

const badges: StaffBadge[] = [
  'active',
  'vacation',
  'invited',
  'external',
  'vacancy',
  'deactivated',
];

type Filters = { roles: RoleCode[]; badges: StaffBadge[]; departments: string[] };

const parseList = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);

/**
 * «Роли и доступ»: сотрудники, роли, приглашения и увольнения (право staff.view).
 * Поиск, фильтр и открытая карточка — в адресе (?q=&role=&status=&dep=&user=).
 */
export function RolesPage() {
  const { t } = useTranslation();
  const staff = useStaff();
  const [params, setParams] = useSearchParams();
  const [showAll, setShowAll] = useState(false);
  const [inviting, setInviting] = useState<{ vacancy: StaffRow | null } | null>(null);

  const query = params.get('q') ?? '';
  const filters: Filters = {
    roles: parseList(params.get('role')) as RoleCode[],
    badges: parseList(params.get('status')) as StaffBadge[],
    departments: parseList(params.get('dep')),
  };
  const update = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

  const rows = staff.data ?? [];
  const opened = rows.find((r) => r.id === params.get('user')) ?? null;
  const departments = useMemo(() => [...new Set(rows.map((r) => r.department))], [rows]);

  const working = rows.filter((r) => r.status === 'active' || r.status === 'invited').length;
  const external = rows.filter((r) => r.status === 'external').length;
  const vacancies = rows.filter((r) => r.status === 'vacancy').length;
  usePageSubtitle(
    staff.data
      ? [
          t('access.staffCount', { count: working }),
          t('access.externalCount', { count: external }),
          vacancies > 0 && t('access.vacancyCount', { count: vacancies }),
        ]
          .filter(Boolean)
          .join(' · ')
      : undefined,
  );

  const needle = query.trim().toLowerCase();
  const matches = (r: StaffRow) =>
    !needle ||
    [r.name, r.email, r.position, r.role, t(`access.roles.${r.role}`)]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(needle));
  const filtered = rows.filter(
    (r) =>
      matches(r) &&
      (filters.roles.length === 0 || filters.roles.includes(r.role)) &&
      (filters.badges.length === 0 || filters.badges.includes(r.badge)) &&
      (filters.departments.length === 0 || filters.departments.includes(r.department)),
  );
  const narrowed = filtered.length !== rows.length;
  // Короткий список — только без поиска и фильтра; иначе видно всё найденное
  const visible = showAll || narrowed ? filtered : filtered.slice(0, PREVIEW);

  return (
    <div className="flex h-full min-h-[560px] flex-col leading-[normal]">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 px-1">
        {/* Вкладка в макете одна — заголовок со счётчиком, без tablist */}
        <h2 className="relative flex h-10 items-center gap-[7px] px-[4px] text-[13px] font-semibold text-text">
          {t('access.usersTab')}
          <span className="text-[11px] font-medium text-brand-gold">
            {t('access.shownOf', { shown: visible.length, total: rows.length })}
          </span>
          <span
            aria-hidden
            className="absolute inset-x-[4px] bottom-[4px] h-[2px] rounded-[1px] bg-brand-red"
          />
        </h2>
        <div className="flex items-center gap-2">
          <label className="relative flex h-8 w-[200px] items-center">
            <SearchIcon size={16} className="pointer-events-none absolute left-[10px] text-dim" />
            <input
              type="search"
              value={query}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={t('access.search')}
              aria-label={t('access.search')}
              className="h-full w-full rounded-9 border border-line bg-panel pl-[34px] pr-[8px] text-[11.5px] text-text outline-none placeholder:text-dim focus:border-info"
            />
          </label>
          <FilterMenu
            rows={rows}
            departments={departments}
            value={filters}
            onChange={(f) =>
              update({
                role: f.roles.join(','),
                status: f.badges.join(','),
                dep: f.departments.join(','),
              })
            }
          />
          <Can permission="staff.manage">
            <button
              type="button"
              onClick={() => setInviting({ vacancy: null })}
              className="flex h-8 items-center gap-[5px] rounded-9 bg-brand-red px-3 text-[12.5px] font-semibold tracking-[-0.1px] text-[#FFFFFF] hover:opacity-90"
            >
              <PlusIcon size={16} />
              {t('access.invite')}
            </button>
          </Can>
        </div>
      </div>

      <section
        aria-label={t('access.usersTab')}
        className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-14 border border-line bg-panel"
      >
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[380px]" />
            <col className="w-[320px]" />
            <col className="w-[280px]" />
            <col />
            <col className="w-[58px]" />
          </colgroup>
          <thead>
            <tr className="h-[39px] border-b border-line text-[11px] font-medium text-dim">
              <th className="pl-4 font-medium">{t('access.colUser')}</th>
              <th className="font-medium">{t('access.role')}</th>
              <th className="font-medium">{t('access.department')}</th>
              <th className="font-medium">{t('access.colStatus')}</th>
              <th>
                <span className="sr-only">{t('access.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <Row
                key={r.id}
                row={r}
                onOpen={() => update({ user: r.id })}
                onInvite={() => setInviting({ vacancy: r })}
              />
            ))}
          </tbody>
        </table>
        {staff.data && visible.length === 0 && (
          <p className="px-4 py-10 text-center text-[12.5px] text-dim">
            {t('access.nothingFound')}
          </p>
        )}

        <div className="px-4 pb-4">
          {!narrowed && rows.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-[10px] flex h-8 w-full items-center justify-between text-[12px] font-medium text-info hover:opacity-80"
            >
              {showAll ? t('access.showLess') : t('access.showAll', { count: rows.length })}
              <ArrowRightIcon size={14} className={showAll ? '-rotate-90' : ''} />
            </button>
          )}
          <div className="mt-3 flex gap-[10px] rounded-9 border border-danger-line bg-danger-soft px-[14px] py-[9px]">
            <MailMediumIcon size={16} className="mt-px shrink-0 text-faint" />
            <div>
              <p className="text-[11.5px] text-sub">{t('access.noteTitle')}</p>
              <p className="mt-[2px] text-[10.5px] text-dim">{t('access.noteText')}</p>
            </div>
          </div>
        </div>
      </section>

      <UserCard
        member={opened}
        onClose={() => update({ user: null })}
        onInvite={(vacancy) => {
          update({ user: null });
          setInviting({ vacancy });
        }}
      />
      <InviteDialog
        open={inviting !== null}
        vacancy={inviting?.vacancy ?? null}
        departments={departments}
        onClose={() => setInviting(null)}
      />
    </div>
  );
}

function Row({
  row: r,
  onOpen,
  onInvite,
}: {
  row: StaffRow;
  onOpen: () => void;
  onInvite: () => void;
}) {
  const { t } = useTranslation();
  const dim = r.status === 'deactivated' || r.status === 'vacancy';
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(r.email ?? '');
      toast.success({ title: t('access.emailCopied') });
    } catch {
      toast.error({ title: t('errors.unknown') });
    }
  };
  const item =
    'flex h-[34px] cursor-pointer items-center rounded-[7px] px-3 text-[12px] text-sub outline-none data-[highlighted]:bg-popover-active data-[highlighted]:text-text';

  return (
    <tr
      className="h-[57px] cursor-pointer border-b border-line hover:bg-row-highlight"
      onClick={onOpen}
    >
      <td className="pl-4">
        <div className="flex items-center gap-[10px]">
          <StaffAvatar name={r.name} tone={r.tone} size={30} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* Строка открывается кликом; кнопка — для клавиатуры и экранных дикторов */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                className={`truncate text-left text-[13px] font-medium tracking-[-0.1px] ${
                  dim ? 'text-sub' : 'text-text'
                }`}
              >
                {r.name ?? r.position}
              </button>
              {r.isMe && (
                <span className="flex h-4 items-center rounded-[4px] bg-chip px-[6px] text-[9.5px] font-medium text-chip-text">
                  {t('access.you')}
                </span>
              )}
            </div>
            <p className="mt-[3px] truncate text-[11px] text-dim">
              {r.email ?? t('access.vacant')}
            </p>
          </div>
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <RoleCodeChip role={r.role} />
          <span className={`truncate text-[12.5px] ${dim ? 'text-sub' : 'text-text'}`}>
            {t(`access.roles.${r.role}`)}
          </span>
        </div>
      </td>
      <td className={`truncate text-[12.5px] ${r.status === 'external' ? 'text-dim' : 'text-sub'}`}>
        {r.department}
      </td>
      <td>
        <StatusBadge badge={r.badge} />
      </td>
      <td>
        <DropdownMenu.Root>
          <Tooltip content={t('access.actions')}>
            <DropdownMenu.Trigger
              onClick={(e) => e.stopPropagation()}
              aria-label={`${t('access.actions')}: ${r.name ?? r.position}`}
              className="flex size-[26px] items-center justify-center rounded-6 text-dim hover:bg-row-highlight hover:text-text data-[state=open]:bg-row-highlight"
            >
              <MoreIcon size={16} />
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              // Меню в портале, но события React всплывают до строки — не открывать карточку
              onClick={(e) => e.stopPropagation()}
              align="end"
              sideOffset={6}
              className="z-50 w-[210px] rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
            >
              <DropdownMenu.Item onSelect={onOpen} className={item}>
                {t('access.openCard')}
              </DropdownMenu.Item>
              {r.status === 'vacancy' ? (
                <Can permission="staff.manage">
                  <DropdownMenu.Item onSelect={onInvite} className={item}>
                    {t('access.inviteToVacancy')}
                  </DropdownMenu.Item>
                </Can>
              ) : (
                <DropdownMenu.Item onSelect={copyEmail} className={item}>
                  {t('access.copyEmail')}
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </td>
    </tr>
  );
}

/** Фильтр по роли, статусу и департаменту; у пунктов — сколько строк подойдёт */
function FilterMenu({
  rows,
  departments,
  value,
  onChange,
}: {
  rows: StaffRow[];
  departments: string[];
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const { t } = useTranslation();
  const active = value.roles.length + value.badges.length + value.departments.length;
  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  const row =
    'flex h-8 cursor-pointer items-center gap-[9px] rounded-[7px] px-[10px] text-[12px] text-sub outline-none data-[highlighted]:bg-popover-active data-[highlighted]:text-text';
  const box = (checked: boolean) => (
    <span
      aria-hidden
      className={`flex size-[14px] shrink-0 items-center justify-center rounded-[4px] border ${
        checked ? 'border-info bg-info text-[#FFFFFF]' : 'border-line'
      }`}
    >
      {checked && <CheckboxCheckIcon size={10} />}
    </span>
  );
  const heading =
    'px-[10px] pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[1.2px] text-dim';
  const count = (n: number) => <span className="ml-auto text-[10.5px] text-dim">{n}</span>;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`flex h-8 items-center gap-[6px] rounded-9 border px-[11px] text-[12.5px] font-medium ${
          active > 0
            ? 'border-info-line bg-info-chip text-info'
            : 'border-line text-sub hover:text-text'
        }`}
      >
        <FilterIcon size={16} />
        {t('access.filter')}
        {active > 0 && <span className="text-[11px]">{active}</span>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 max-h-[70vh] w-[260px] overflow-y-auto rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        >
          <DropdownMenu.Label className={heading}>{t('access.role')}</DropdownMenu.Label>
          {roleCodes.map((role) => (
            <DropdownMenu.CheckboxItem
              key={role}
              checked={value.roles.includes(role)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onChange({ ...value, roles: toggle(value.roles, role) })}
              className={row}
            >
              {box(value.roles.includes(role))}
              <span className="w-6 font-medium">{role}</span>
              <span className="truncate">{t(`access.roles.${role}`)}</span>
              {count(rows.filter((r) => r.role === role).length)}
            </DropdownMenu.CheckboxItem>
          ))}
          <DropdownMenu.Separator className="my-[5px] h-px bg-line" />
          <DropdownMenu.Label className={heading}>{t('access.colStatus')}</DropdownMenu.Label>
          {badges.map((b) => (
            <DropdownMenu.CheckboxItem
              key={b}
              checked={value.badges.includes(b)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onChange({ ...value, badges: toggle(value.badges, b) })}
              className={row}
            >
              {box(value.badges.includes(b))}
              {t(`access.status.${b}`)}
              {count(rows.filter((r) => r.badge === b).length)}
            </DropdownMenu.CheckboxItem>
          ))}
          <DropdownMenu.Separator className="my-[5px] h-px bg-line" />
          <DropdownMenu.Label className={heading}>{t('access.department')}</DropdownMenu.Label>
          {departments.map((d) => (
            <DropdownMenu.CheckboxItem
              key={d}
              checked={value.departments.includes(d)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() =>
                onChange({ ...value, departments: toggle(value.departments, d) })
              }
              className={row}
            >
              {box(value.departments.includes(d))}
              <span className="truncate">{d}</span>
              {count(rows.filter((r) => r.department === d).length)}
            </DropdownMenu.CheckboxItem>
          ))}
          {active > 0 && (
            <>
              <DropdownMenu.Separator className="my-[5px] h-px bg-line" />
              <DropdownMenu.Item
                onSelect={() => onChange({ roles: [], badges: [], departments: [] })}
                className={`${row} font-medium text-info`}
              >
                {t('access.filterReset')}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
