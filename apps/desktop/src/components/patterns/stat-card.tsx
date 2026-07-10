import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

export function StatCard({ label, value, icon: Icon, detail }: { label: string; value: ReactNode; icon?: LucideIcon; detail?: ReactNode }) {
  return <Card size="sm"><CardContent className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>{detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}</div>{Icon && <Icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />}</CardContent></Card>;
}
