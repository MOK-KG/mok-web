import { useTranslation } from 'react-i18next';
import { ArrowRightIcon, MailLargeIcon } from '@/shared/ui/icons';
import { useMailQueueSummary } from '../api';

/** Полоса очереди из почты над доской (макет Figma: «Очередь из почты») */
export function QueueBanner() {
  const { t } = useTranslation();
  const { data } = useMailQueueSummary();
  if (!data || data.ready + data.manual === 0) return null;
  return (
    <div
      role="status"
      className="relative flex items-center gap-[10px] overflow-hidden rounded-12 border border-warning-line bg-warning-soft py-[9px] pl-[17px] pr-[14px]"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-warning" />
      <MailLargeIcon size={18} className="shrink-0 text-warning-text" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-[-0.1px] text-warning-text">
          {t('tasks.queueTitle', { ready: data.ready, manual: data.manual })}
        </p>
        <p className="mt-[1px] text-[11.5px] text-sub">{t('tasks.queueText')}</p>
      </div>
      <button
        type="button"
        disabled
        title={t('tasks.comingSoon')}
        className="flex h-[30px] items-center gap-2 rounded-8 border border-warning-line px-[13px] text-[12px] font-semibold tracking-[-0.1px] text-warning-text disabled:cursor-not-allowed"
      >
        {t('tasks.queueOpen')}
        <ArrowRightIcon size={14} />
      </button>
    </div>
  );
}
