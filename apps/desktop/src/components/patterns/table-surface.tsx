import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function TableSurface({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('overflow-x-auto rounded-xl border bg-card', className)} {...props} />;
}
