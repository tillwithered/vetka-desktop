import { ChevronDownIcon, HeartIcon, ImageIcon, MoreHorizontalIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatKzt, formatMoney } from '@/renderer/lib/ipc-query';
import type { CurrentPrice, Doll } from '@/shared/contracts';

function PriceCell({ prices }: { prices: CurrentPrice[] }) {
  if (!prices.length) return <span className="text-muted-foreground">—</span>;
  const best = [...prices].sort((left, right) => left.priceKztMinor - right.priceKztMinor)[0]!;
  return (
    <Collapsible>
      <div className="flex items-center gap-1"><span className="whitespace-nowrap font-medium">{formatMoney(best.priceMinor, best.currency)} · {best.region.replace('amazon_', '').toUpperCase()}</span><CollapsibleTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="Показать цены"><ChevronDownIcon /></Button></CollapsibleTrigger></div>
      <CollapsibleContent className="space-y-1 pt-2 text-xs text-muted-foreground">{prices.map((price) => <a key={price.listingId} className="block hover:underline" href={price.url} target="_blank" rel="noreferrer">{price.region.replace('amazon_', '').toUpperCase()} · {formatMoney(price.priceMinor, price.currency)} · {formatKzt(price.priceKztMinor)}</a>)}</CollapsibleContent>
    </Collapsible>
  );
}

export function DollTable({ dolls, pricesByDoll = {}, onFavorite }: { dolls: Doll[]; pricesByDoll?: Record<string, CurrentPrice[]>; onFavorite(doll: Doll): void }) {
  return <Table className="table-fixed"><TableHeader><TableRow><TableHead className="w-[min(52vw,720px)]">Кукла</TableHead><TableHead className="w-56">Линейка</TableHead><TableHead className="w-20">Артикул</TableHead><TableHead className="w-48">Цены</TableHead><TableHead className="w-24 text-right">Действия</TableHead></TableRow></TableHeader><TableBody>{dolls.map((doll) => <TableRow key={doll.id}><TableCell className="min-w-0"><div className="flex min-w-0 items-center gap-3">{doll.imagePath ? <img className="size-9 shrink-0 rounded-md object-cover" src={doll.imagePath} alt={`Миниатюра ${doll.name}`} /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-label="Нет изображения"><ImageIcon className="size-4" /></span>}<div className="min-w-0"><Link className="block truncate font-medium hover:underline" title={doll.name} to={`/dolls/${doll.id}`}>{doll.name}</Link>{doll.characterName && <div className="truncate text-xs text-muted-foreground" title={doll.characterName}>{doll.characterName}</div>}</div></div></TableCell><TableCell className="truncate">{doll.lineName ? <Badge className="max-w-full truncate" variant="secondary">{doll.lineName}{doll.generation ? ` · ${doll.generation}` : ''}</Badge> : '—'}</TableCell><TableCell className="font-mono text-xs">{doll.mattelSku ?? doll.upcEan ?? '—'}</TableCell><TableCell><PriceCell prices={pricesByDoll[doll.id] ?? []} /></TableCell><TableCell className="text-right"><Button size="icon-sm" variant={doll.isFavorite ? 'secondary' : 'ghost'} aria-label={doll.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={() => onFavorite(doll)}><HeartIcon className={doll.isFavorite ? 'fill-current' : ''} /></Button><Button asChild size="icon-sm" variant="ghost"><Link to={`/dolls/${doll.id}`} aria-label="Открыть карточку"><MoreHorizontalIcon /></Link></Button></TableCell></TableRow>)}</TableBody></Table>;
}
