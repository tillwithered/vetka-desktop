import type React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input', className)} {...props}><SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-[state=checked]:translate-x-4" /></SwitchPrimitive.Root>;
}
