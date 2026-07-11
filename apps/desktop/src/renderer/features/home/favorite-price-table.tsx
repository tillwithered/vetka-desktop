import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { HeartIcon, RefreshCwIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney, unwrap } from '@/renderer/lib/ipc-query';
import type { AmazonRegion, Doll } from '@/shared/contracts';

const regions: Array<{ id: AmazonRegion; label: string }> = [{ id: 'amazon_us', label: 'US' }, { id: 'amazon_uk', label: 'UK' }, { id: 'amazon_de', label: 'DE' }, { id: 'amazon_es', label: 'ES' }, { id: 'amazon_it', label: 'IT' }];

export function FavoritePriceTable({ dolls, onFavorite }: { dolls: Doll[]; onFavorite(doll: Doll): void }) {
  const client = useQueryClient();
  const priceQueries = useQueries({ queries: dolls.map((doll) => ({ queryKey: ['prices', doll.id], queryFn: async () => unwrap(await window.vetka.prices.current(doll.id)) })) });
  const refresh = useMutation({
    mutationFn: async () => unwrap(await window.vetka.catalog.refreshNow()),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['prices'] }); toast.success('Цены Monster High Store обновлены'); },
    onError: (error) => toast.error(error.message),
  });
  return <Table><TableHeader><TableRow><TableHead className="min-w-56">Кукла</TableHead>{regions.map((region) => <TableHead key={region.id}>{region.label}</TableHead>)}<TableHead className="w-32 text-right">Действия</TableHead></TableRow></TableHeader><TableBody>{dolls.map((doll, index) => {
    const prices = priceQueries[index].data ?? [];
    return <TableRow key={doll.id}><TableCell><Link className="font-medium hover:underline" to={`/dolls/${doll.id}`}>{doll.name}</Link><div className="text-xs text-muted-foreground">{doll.mattelSku ?? doll.lineName ?? 'Ручная карточка'}</div></TableCell>{regions.map((region) => { const price = prices.find((item) => item.region === region.id); return <TableCell key={region.id}>{price ? <div><span className="font-medium">{formatMoney(price.priceMinor, price.currency)}</span>{price.latestCheckStatus !== 'verified' && <Badge variant="destructive" className="ml-1">!</Badge>}</div> : <span className="text-muted-foreground">—</span>}</TableCell>; })}<TableCell className="text-right"><Button size="icon-sm" variant="ghost" aria-label="Обновить цены" disabled={refresh.isPending} onClick={() => refresh.mutate()}><RefreshCwIcon className={refresh.isPending ? 'animate-spin' : ''} /></Button><Button size="icon-sm" variant="ghost" aria-label="Убрать из избранного" onClick={() => onFavorite(doll)}><HeartIcon className="fill-current" /></Button></TableCell></TableRow>;
  })}</TableBody></Table>;
}
