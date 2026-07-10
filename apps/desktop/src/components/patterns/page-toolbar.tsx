import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function PageToolbar({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap items-center justify-between gap-3', className)} {...props} />;
}
