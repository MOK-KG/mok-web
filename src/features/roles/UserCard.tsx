import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCan } from '@/features/auth';
import { type RoleCode, roleCodes } from '@/shared/config/permissions';
import { formatIsoDate } from '@/shared/lib/date';
import {
  AlertMiniIcon,
  CheckIcon,
  CheckSmallIcon,
  ChevronSmallIcon,
  HistorySwapIcon,
  LockIcon,
  XIcon,
} from '@/shared/ui/icons';
import { type StaffRow, useChangeRole, useDeactivate } from './api';
import { capsTitle, RoleCodeChip, StaffAvatar, StatusBadge } from './parts';

/** Карточка сотрудника: роль (меняется сразу), сведения и увольнение */
export function UserCard({
  member,
  onClose,
  onInvite,
}: {
  member: StaffRow | null;
  onClose: () => void;
  /** Пригласить на вакансию */
  onInvite: (vacancy: StaffRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={member !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(3,6,12,0.6)] backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-48px)] w-[min(620px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-18 border border-line bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          {member && <Card member={member} onClose={onClose} onInvite={onInvite} />}
          <Dialog.Close
            aria-label={t('access.close')}
            className="absolute right-[24px] top-[28px] flex size-8 items-center justify-center rounded-8 text-faint hover:bg-row-highlight hover:text-text"
          >
            <XIcon size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Card({
  member: m,
  onClose,
  onInvite,
}: {
  member: StaffRow;
  onClose: () => void;
  onInvite: (vacancy: StaffRow) => void;
}) {
  const { t, i18n } = useTranslation();
  const { can } = useCan();
  const changeRole = useChangeRole();
  const deactivated = m.status === 'deactivated';
  const vacancy = m.status === 'vacancy';
  const canAssign = can('roles.assign') && !deactivated;
  const date = (iso: string) => formatIsoDate(iso.slice(0, 10), 'd MMMM yyyy', i18n.language);
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bishkek',
    });

  const pickRole = (role: RoleCode) => {
    if (role === m.role) return;
    // Своя роль: права меняются сразу, раздел может закрыться — спросить
    if (m.isMe && !window.confirm(t('access.ownRoleConfirm', { role }))) return;
    changeRole.mutate({ id: m.id, role });
  };

  const label = 'text-[11px] text-dim';
  const value = 'mt-[2px] text-[13px] text-text';

  return (
    <div className="leading-[normal]">
      <header className="flex items-center gap-[14px] border-b border-line px-7 pb-6 pt-[26px] pr-[76px]">
        <StaffAvatar name={m.name} tone={m.tone} size={48} />
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate text-[19px] font-semibold tracking-[-0.4px] text-text">
            {m.name ?? m.position}
          </Dialog.Title>
          <p className="mt-[3px] truncate text-[12px] text-faint">
            {vacancy
              ? t('access.vacant')
              : `${m.email} · ${
                  // «Административный» → «Административный департамент»; «Аппарат» — как есть
                  /(ый|ий|ой)$/.test(m.department)
                    ? t('access.departmentOf', { name: m.department })
                    : m.department
                }`}
          </p>
        </div>
        <StatusBadge badge={m.badge} />
      </header>

      <div className="px-7 pb-7 pt-[22px]">
        <h3 className={capsTitle}>{t('access.role')}</h3>
        <Select.Root
          value={m.role}
          onValueChange={(v) => pickRole(v as RoleCode)}
          disabled={!canAssign}
        >
          <Select.Trigger
            aria-label={t('access.role')}
            className="mt-[10px] flex h-12 w-full items-center gap-[10px] rounded-9 border border-line bg-column px-[14px] text-left outline-none focus:border-info disabled:cursor-default disabled:opacity-80"
          >
            <RoleCodeChip role={m.role} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-text">
                {t(`access.roles.${m.role}`)}
              </span>
              <span className="block truncate text-[10.5px] text-dim">
                {t(`access.roleHints.${m.role}`)}
              </span>
            </span>
            {canAssign && <ChevronSmallIcon size={14} className="text-faint" />}
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={6}
              className="z-[60] max-h-80 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-11 border border-line bg-popover p-[5px] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
            >
              <Select.Viewport>
                {roleCodes.map((role) => (
                  <Select.Item
                    key={role}
                    value={role}
                    className="flex cursor-pointer items-center gap-[10px] rounded-[7px] px-[10px] py-[7px] outline-none data-[highlighted]:bg-popover-active data-[state=checked]:bg-popover-active"
                  >
                    <RoleCodeChip role={role} />
                    <span className="min-w-0 flex-1">
                      <Select.ItemText>
                        <span className="block text-[12.5px] font-medium text-text">
                          {t(`access.roles.${role}`)}
                        </span>
                      </Select.ItemText>
                      <span className="block truncate text-[10.5px] text-dim">
                        {t(`access.roleHints.${role}`)}
                      </span>
                    </span>
                    <Select.ItemIndicator className="text-brand-gold">
                      <CheckIcon size={14} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        {!deactivated && (
          <div className="mt-[10px] flex gap-[9px] rounded-9 border border-info-line bg-info-chip px-3 py-[9px]">
            <LockIcon size={16} className="mt-px shrink-0 text-info" />
            <div>
              <p className="text-[11.5px] font-semibold text-info">{t('access.immediate')}</p>
              <p className="mt-[2px] text-[11px] text-sub">{t('access.immediateHint')}</p>
            </div>
          </div>
        )}

        <hr className="my-[22px] border-line" />
        <h3 className={capsTitle}>{t('access.details')}</h3>
        <dl className="mt-[10px] grid grid-cols-2 gap-x-4 gap-y-[14px]">
          <div className="col-span-2">
            <dt className={label}>{t('access.position')}</dt>
            <dd className={value}>{m.position}</dd>
          </div>
          {!vacancy && (
            <>
              <div>
                <dt className={label}>{t('access.invitedAt')}</dt>
                <dd className={value}>
                  {m.invitedAt ? [date(m.invitedAt), m.invitedBy].filter(Boolean).join(' · ') : '—'}
                </dd>
              </div>
              <div>
                <dt className={label}>{t('access.firstLogin')}</dt>
                <dd className={value}>
                  {m.firstLoginAt
                    ? `${date(m.firstLoginAt)}, ${time(m.firstLoginAt)}`
                    : t('access.neverLoggedIn')}
                </dd>
              </div>
              <div>
                <dt className={label}>{t('access.activeTasks')}</dt>
                <dd className={`${value} ${m.plan.escalated > 0 ? 'text-warning-text' : ''}`}>
                  {m.plan.tasks}
                  {m.plan.escalated > 0 && ` · ${t('access.withEscalation')}`}
                </dd>
              </div>
              <div>
                <dt className={label}>{t('access.deputy')}</dt>
                <dd className={value}>{m.deputy ?? '—'}</dd>
              </div>
              <div>
                <dt className={label}>{t('access.sessions')}</dt>
                <dd className={value}>
                  {m.sessions > 0
                    ? t('access.devices', { count: m.sessions })
                    : t('access.noSessions')}
                </dd>
              </div>
            </>
          )}
        </dl>

        {vacancy ? (
          can('staff.manage') && (
            <button
              type="button"
              onClick={() => onInvite(m)}
              className="mt-6 flex h-[42px] items-center gap-2 rounded-9 bg-brand-red px-4 text-[13px] font-semibold text-[#FFFFFF] hover:opacity-90"
            >
              {t('access.inviteToVacancy')}
            </button>
          )
        ) : (
          <>
            <hr className="my-[22px] border-line" />
            {deactivated ? (
              <Deactivated member={m} />
            ) : (
              <Deactivation member={m} onDone={onClose} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Что будет при увольнении — и кнопка с подтверждением */
function Deactivation({ member: m, onDone }: { member: StaffRow; onDone: () => void }) {
  const { t } = useTranslation();
  const { can } = useCan();
  const deactivate = useDeactivate();
  const [confirming, setConfirming] = useState(false);
  const { plan } = m;
  const to = plan.reassignTo;

  const items = [
    { Icon: LockIcon, title: t('access.loginClosed'), text: t('access.loginClosedHint') },
    { Icon: XIcon, title: t('access.sessionsEnded'), text: t('access.sessionsEndedHint') },
    {
      Icon: HistorySwapIcon,
      title:
        plan.tasks > 0 ? t('access.tasksReassigned', { count: plan.tasks }) : t('access.noTasks'),
      text:
        plan.tasks === 0
          ? t('access.noTasksHint')
          : to
            ? t(to.isDirector ? 'access.toDirector' : 'access.toManager', { name: to.short })
            : t('access.noSuccessor'),
    },
    {
      Icon: CheckSmallIcon,
      title: t('access.authorshipKept'),
      text: t('access.authorshipKeptHint'),
    },
  ];

  return (
    <section aria-labelledby="deactivation-title">
      <h3
        id="deactivation-title"
        className="flex items-center gap-[6px] text-[10px] font-semibold uppercase tracking-[1.4px] text-danger"
      >
        <AlertMiniIcon size={14} />
        {t('access.dismissal')}
      </h3>
      <p className="mt-[10px] text-[12px] text-sub">{t('access.whatHappens')}</p>
      <ul className="mt-2 flex flex-col gap-[11px]">
        {items.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-[7px]">
            <Icon size={13} className="mt-[1px] shrink-0 text-faint" />
            <div>
              <p className="text-[12px] text-text">{title}</p>
              <p className="mt-[1px] text-[11px] text-dim">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      {can('staff.deactivate') && (
        <div className="mt-[18px] flex flex-wrap items-center gap-4">
          {m.isMe ? (
            <p className="text-[11.5px] text-dim">{t('access.cannotDeactivateSelf')}</p>
          ) : confirming ? (
            <>
              <button
                type="button"
                disabled={deactivate.isPending}
                onClick={() =>
                  deactivate
                    .mutateAsync(m.id)
                    .then(onDone)
                    .catch(() => setConfirming(false))
                }
                className="flex h-[42px] items-center gap-2 rounded-9 bg-brand-red px-4 text-[13px] font-semibold text-[#FFFFFF] hover:opacity-90 disabled:opacity-60"
              >
                <LockIcon size={16} />
                {t('access.confirmDeactivate', { name: m.short })}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex h-[42px] items-center rounded-9 border border-line px-4 text-[13px] font-medium text-sub hover:text-text"
              >
                {t('access.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-[42px] w-[236px] items-center gap-[10px] rounded-9 border border-danger-line bg-danger-soft px-4 text-[13px] font-semibold text-danger hover:opacity-90"
            >
              <LockIcon size={16} />
              {t('access.deactivate')}
            </button>
          )}
          <p className="text-[11px] text-dim">{t('access.cannotDelete')}</p>
        </div>
      )}
    </section>
  );
}

function Deactivated({ member: m }: { member: StaffRow }) {
  const { t, i18n } = useTranslation();
  return (
    <section className="rounded-9 border border-danger-line bg-danger-soft px-[14px] py-3">
      <p className="text-[12.5px] font-semibold text-danger">
        {t('access.deactivatedOn', {
          date: m.deactivatedAt ? formatIsoDate(m.deactivatedAt, 'd MMMM yyyy', i18n.language) : '',
          by: m.deactivatedBy ?? '',
        })}
      </p>
      <p className="mt-1 text-[11.5px] leading-4 text-sub">{t('access.deactivatedText')}</p>
    </section>
  );
}
