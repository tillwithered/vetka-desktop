import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, HeartIcon, RefreshCwIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceHistoryChart } from '@/renderer/features/prices/price-history-chart';
import { RegionalOfferList } from '@/renderer/features/prices/regional-offer-list';
import { unwrap } from '@/renderer/lib/ipc-query';
import type { AmazonRegion } from '@/shared/contracts';

const allRegions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'];

export function DollDetailPage() {
  const { id = '' } = useParams();
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const client = useQueryClient();
  const doll = useQuery({ queryKey: ['doll', id], queryFn: async () => unwrap(await window.vetka.dolls.get(id)) });
  const prices = useQuery({ queryKey: ['prices', id], queryFn: async () => unwrap(await window.vetka.prices.current(id)) });
  const history = useQuery({ queryKey: ['history', id, range], queryFn: async () => unwrap(await window.vetka.prices.history(id, range)) });
  const refresh = useMutation({ mutationFn: async () => unwrap(await window.vetka.amazon.refreshDoll(id, allRegions)), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['prices', id] }); await client.invalidateQueries({ queryKey: ['history', id] }); toast.success('Проверка Amazon завершена'); }, onError: (error) => toast.error(error.message) });
  const favorite = useMutation({ mutationFn: async () => doll.data && unwrap(await window.vetka.dolls.setFavorite(id, !doll.data.isFavorite)), onSuccess: async () => client.invalidateQueries({ queryKey: ['doll', id] }) });

  if (!doll.data) return <div className="p-6 text-sm text-muted-foreground">Загружаю карточку…</div>;
  return <section className="flex flex-1 flex-col gap-6 p-6">
    <Button asChild variant="ghost" className="w-fit"><Link to="/dolls"><ArrowLeftIcon />К списку</Link></Button>
    <Card><CardContent className="flex items-center gap-5 py-5"><div className="flex size-20 items-center justify-center rounded-xl bg-muted text-2xl font-semibold">{doll.data.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-2xl font-semibold">{doll.data.name}</h1>{doll.data.generation && <Badge variant="secondary">{doll.data.generation}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{[doll.data.characterName, doll.data.lineName, doll.data.mattelSku].filter(Boolean).join(' · ') || 'Ручная карточка'}</p></div><Button size="icon" variant={doll.data.isFavorite ? 'secondary' : 'outline'} onClick={() => favorite.mutate()} aria-label="Избранное"><HeartIcon className={doll.data.isFavorite ? 'fill-current' : ''} /></Button><Button onClick={() => refresh.mutate()} disabled={refresh.isPending}><RefreshCwIcon className={refresh.isPending ? 'animate-spin' : ''} />{refresh.isPending ? 'Проверяю…' : 'Обновить цены'}</Button></CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]"><Card><CardHeader><CardTitle>История цены</CardTitle><CardDescription>Сохранённая стоимость в тенге на момент проверки</CardDescription></CardHeader><CardContent><PriceHistoryChart points={history.data ?? []} range={range} onRangeChange={setRange} /></CardContent></Card><Card><CardHeader><CardTitle>Регионы Amazon</CardTitle><CardDescription>Только подтверждённые предложения в состоянии New</CardDescription></CardHeader><CardContent><RegionalOfferList prices={prices.data ?? []} /></CardContent></Card></div>
  </section>;
}
