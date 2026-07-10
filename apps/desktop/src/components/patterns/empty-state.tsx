import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return <Empty className="min-h-56 py-8"><EmptyHeader>{Icon && <EmptyMedia variant="icon"><Icon /></EmptyMedia>}<h2 className="font-heading text-lg font-medium tracking-tight">{title}</h2>{description && <EmptyDescription>{description}</EmptyDescription>}</EmptyHeader>{action && <EmptyContent>{action}</EmptyContent>}</Empty>;
}
