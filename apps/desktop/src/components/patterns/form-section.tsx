import type { ReactNode } from 'react';

export function FormSection({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <section className="max-w-2xl space-y-4"><div className="space-y-1"><h2 className="font-heading text-base font-medium">{title}</h2>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div>{children}</section>;
}
