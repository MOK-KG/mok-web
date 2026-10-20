import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

type Props = {
  /** Текст подсказки; пусто — подсказки нет, остаётся только сам элемент */
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
};

/**
 * Подсказка при наведении и фокусе с клавиатуры. Ребёнок — один элемент, способный
 * получить фокус (кнопка, ссылка). Подсказка не заменяет aria-label у иконок-кнопок.
 * Задержка показа — в Tooltip.Provider (AppProviders).
 */
export function Tooltip({ content, children, side = 'top', align = 'center' }: Props) {
  if (!content) return children;
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          className="z-[90] max-w-[260px] rounded-8 border border-line bg-popover px-[10px] py-[6px] text-[12px] font-medium leading-4 text-text shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
