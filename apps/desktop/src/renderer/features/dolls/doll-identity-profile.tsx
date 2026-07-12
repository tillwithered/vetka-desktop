import { ExternalLinkIcon, ImageIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Doll } from '@/shared/contracts';

type Fact = { label: string; value: string | null; fullWidth?: boolean };

export function DollIdentityProfile({ doll }: { doll: Doll }) {
  const facts: Fact[] = [
    { label: 'Персонаж', value: doll.characterName },
    { label: 'Серия', value: doll.lineName },
    { label: 'Поколение', value: doll.generation },
    { label: 'Mattel SKU', value: doll.mattelSku },
    { label: 'UPC / EAN', value: doll.upcEan },
    { label: 'Официальное название', value: doll.officialName, fullWidth: true },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>О кукле</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          {doll.imagePath
            ? <img className="size-36 shrink-0 rounded-lg object-cover" src={doll.imagePath} alt={doll.name} />
            : <div className="flex size-36 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-label="Нет фото куклы"><ImageIcon className="size-8" /></div>}
          <div className="min-w-0 space-y-2">
            <p className="font-heading text-lg font-semibold leading-tight">{doll.name}</p>
            <div className="flex flex-wrap gap-2">
              {doll.lineName ? <Badge variant="secondary">{doll.lineName}</Badge> : null}
              {doll.generation ? <Badge variant="outline">{doll.generation}</Badge> : null}
            </div>
          </div>
        </div>
        <Separator />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {facts.map((fact) => <div key={fact.label} className={fact.fullWidth ? 'col-span-2 min-w-0 space-y-0.5' : 'min-w-0 space-y-0.5'}><dt className="text-xs text-muted-foreground">{fact.label}</dt><dd className={fact.fullWidth ? 'break-words font-medium leading-snug' : 'truncate font-medium'}>{fact.value ?? '—'}</dd></div>)}
        </dl>
        {doll.mattelUrl ? <Button asChild size="sm" variant="outline" className="w-fit"><a href={doll.mattelUrl} target="_blank" rel="noreferrer">Открыть на Mattel<ExternalLinkIcon /></a></Button> : null}
      </CardContent>
    </Card>
  );
}
