import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, HeartIcon, RefreshCwIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ChartCard } from '@/components/patterns/chart-card';
import { PageHeader } from '@/components/patterns/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollIdentityProfile } from '@/renderer/features/dolls/doll-identity-profile';
import { CreateOrderSheet } from '@/renderer/features/orders/create-order-sheet';
import { PriceHistoryChart } from '@/renderer/features/prices/price-history-chart';
import { RegionalOfferList } from '@/renderer/features/prices/regional-offer-list';
import { unwrap } from '@/renderer/lib/ipc-query';
import type { AmazonRegion } from '@/shared/contracts';

const allRegions: AmazonRegion[] = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'];

export function DollDetailPage() {
  const { id = '' } = useParams();
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [challenge, setChallenge] = useState<{ requestId: string; region: AmazonRegion } | null>(null);
  const client = useQueryClient();
  const doll = useQuery({ queryKey: ['doll', id], queryFn: async () => unwrap(await window.vetka.dolls.get(id)) });
  const prices = useQuery({ queryKey: ['prices', id], queryFn: async () => unwrap(await window.vetka.prices.current(id)) });
  const history = useQuery({ queryKey: ['history', id, range], queryFn: async () => unwrap(await window.vetka.prices.history(id, range)) });
  const refresh = useMutation({
    mutationFn: async () => unwrap(await window.vetka.amazon.refreshDoll(id, allRegions)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['prices', id] });
      await client.invalidateQueries({ queryKey: ['history', id] });
      toast.success('Проверка Amazon завершена');
    },
    onError: (error) => toast.error(error.message),
  });
  const favorite = useMutation({ mutationFn: async () => doll.data && unwrap(await window.vetka.dolls.setFavorite(id, !doll.data.isFavorite)), onSuccess: async () => client.invalidateQueries({ queryKey: ['doll', id] }) });

  useEffect(() => window.vetka.amazon.onProgress((event) => {
    if (event.stage === 'captcha_required' && event.region) setChallenge({ requestId: event.requestId, region: event.region });
    if (event.stage === 'completed' || event.stage === 'failed') setChallenge(null);
  }), []);

  if (!doll.data) return <div className="p-6 text-sm text-muted-foreground">Загружаю карточку…</div>;
  const metadata = [doll.data.characterName, doll.data.lineName, doll.data.mattelSku].filter(Boolean).join(' · ') || 'Ручная карточка';

  return (
    <section className="flex flex-1 flex-col gap-6 p-6">
      <Button asChild size="sm" variant="ghost" className="w-fit"><Link to="/dolls"><ArrowLeftIcon />К списку</Link></Button>
      <PageHeader title={doll.data.name} description={metadata} meta={doll.data.generation ? <Badge variant="secondary">{doll.data.generation}</Badge> : undefined} actions={<><Button size="icon-sm" variant={doll.data.isFavorite ? 'secondary' : 'ghost'} aria-label="Избранное" onClick={() => favorite.mutate()}><HeartIcon className={doll.data.isFavorite ? 'fill-current' : ''} /></Button><Button size="sm" variant="secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending}><RefreshCwIcon className={refresh.isPending ? 'animate-spin' : ''} />{refresh.isPending ? 'Проверяю…' : 'Обновить цены'}</Button><CreateOrderSheet prices={prices.data ?? []} /></>} />
      {challenge ? <Alert><AlertTitle>Amazon просит пройти CAPTCHA</AlertTitle><AlertDescription className="flex items-center justify-between gap-4"><span>Завершите проверку в открытом окне браузера.</span><Button size="sm" onClick={async () => { unwrap(await window.vetka.amazon.resumeRegion(challenge.requestId, challenge.region)); setChallenge(null); }}>Продолжить</Button></AlertDescription></Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,1fr)]">
        <DollIdentityProfile doll={doll.data} />
        <Card><CardHeader><CardTitle>Регионы Amazon</CardTitle><CardDescription>Подтверждённые предложения в состоянии New</CardDescription></CardHeader><CardContent><RegionalOfferList prices={prices.data ?? []} /></CardContent></Card>
      </div>
      <ChartCard title="История цены" description="Сохранённая стоимость на момент проверки"><PriceHistoryChart points={history.data ?? []} range={range} onRangeChange={setRange} /></ChartCard>
    </section>
  );
}
