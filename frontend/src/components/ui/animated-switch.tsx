'use client';

import {
  Switch as HeadlessSwitch,
  SwitchThumb,
} from '@/components/animate-ui/primitives/headless/switch';
import { cn } from '@/lib/utils';

type AnimatedSwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  size?: 'sm' | 'default';
};

function AnimatedSwitch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  name,
  id,
  className,
  size = 'default',
}: AnimatedSwitchProps) {
  return (
    <HeadlessSwitch
      id={id}
      name={name}
      checked={checked}
      defaultChecked={defaultChecked}
      // @ts-expect-error - HeadlessUI/motion type conflict
      onChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        // Base styles
        'shrink-0 rounded-full border border-transparent relative inline-flex items-center outline-none',
        // Focus styles
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-1',
        // Disabled styles
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        // Background: default is unchecked, data-[checked] is checked
        'bg-input data-[checked]:bg-primary',
        // Size
        size === 'default' ? 'h-[18.4px] w-[32px]' : 'h-[14px] w-[24px]',
        // Justify content changes based on checked state
        'justify-start data-[checked]:justify-end',
        className
      )}
    >
      <SwitchThumb
        className={cn(
          'rounded-full pointer-events-none block ring-0',
          // Colors
          'bg-background dark:bg-foreground dark:data-[checked]:bg-primary-foreground',
          // Size
          size === 'default' ? 'size-4' : 'size-3'
        )}
        pressedAnimation={{ scaleX: 1.15 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </HeadlessSwitch>
  );
}

export { AnimatedSwitch };
