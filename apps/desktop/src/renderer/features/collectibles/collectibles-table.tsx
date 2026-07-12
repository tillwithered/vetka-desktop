import { ExternalLinkIcon, ImageIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/renderer/lib/ipc-query';
import type { Collectible, CollectibleLifecycle } from '@/shared/contracts';

const lifecycleLabel: Record<CollectibleLifecycle, string> = {
  in_stock: 'В продаже',
  preorder: 'Предзаказ',
  coming_soon: 'Скоро',
  fang_club: 'Fang Club',
  sold_out: 'Распродано',
};

export function CollectiblesTable({ items }: { items: Collectible[] }) {
  return <Table className="table-fixed"><TableHeader><TableRow>
    <TableHead className="w-[min(46vw,640px)]">Коллекционка</TableHead>
    <TableHead className="w-52">Серия</TableHead>
    <TableHead className="w-24">SKU</TableHead>
    <TableHead className="w-28">Цена Mattel</TableHead>
    <TableHead className="w-32">Статус</TableHead>
    <TableHead className="w-36">Проверено</TableHead>
    <TableHead className="w-36 text-right">Источник</TableHead>
  </TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}>
    <TableCell className="min-w-0"><div className="flex min-w-0 items-center gap-3">
      {item.imageUrl ? <img className="size-9 shrink-0 rounded-md object-cover" src={item.imageUrl} alt={`Миниатюра ${item.nameRu}`} />
        : <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-label="Нет изображения"><ImageIcon className="size-4" /></span>}
      <div className="min-w-0"><div className="truncate font-medium" title={item.nameRu}>{item.nameRu}</div><div className="truncate text-xs text-muted-foreground" title={item.officialName}>{item.officialName}</div></div>
    </div></TableCell>
    <TableCell className="truncate">{item.lineName ? <Badge className="max-w-full truncate" variant="secondary">{item.lineName}</Badge> : '—'}</TableCell>
    <TableCell className="font-mono text-xs">{item.mattelSku ?? '—'}</TableCell>
    <TableCell className="whitespace-nowrap font-medium">{item.priceMinor !== null && item.currency ? formatMoney(item.priceMinor, item.currency) : '—'}</TableCell>
    <TableCell><div className="flex flex-wrap gap-1"><Badge variant={item.lifecycle === 'sold_out' ? 'outline' : 'secondary'}>{lifecycleLabel[item.lifecycle]}</Badge>{item.lastCheckResult === 'error' && <Badge variant="outline">Данные устарели</Badge>}</div></TableCell>
    <TableCell className="text-xs text-muted-foreground">{new Date(item.lastCheckedAt).toLocaleDateString('ru-RU')}</TableCell>
    <TableCell className="text-right"><Button asChild size="sm" variant="outline"><a href={item.canonicalUrl} target="_blank" rel="noreferrer"><ExternalLinkIcon />Открыть на Mattel</a></Button></TableCell>
  </TableRow>)}</TableBody></Table>;
}
