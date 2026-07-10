import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions, meta, className }: { title: string; description?: string; actions?: ReactNode; meta?: ReactNode; className?: string }) {
  return <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}><div className="min-w-0 space-y-1"><h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>{description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}{meta}</div>{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}</header>;
}
