import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, CheckCircle2Icon, TruckIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { formatKzt, formatMoney, unwrap } from '@/renderer/lib/ipc-query';
import type { OrderStatus } from '@/shared/contracts';

const labels: Record<OrderStatus, string> = { new: 'Новый', awaiting_payment: 'Ждём оплату', ordered: 'Заказан', shipped: 'Отправлен', warehouse: 'На складе', in_transit: 'В пути', received: 'Получен', delivered: 'Выдан' };
const next: Partial<Record<OrderStatus, OrderStatus>> = { new: 'awaiting_payment', awaiting_payment: 'ordered', ordered: 'shipped', shipped: 'warehouse', warehouse: 'in_transit', in_transit: 'received', received: 'delivered' };

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const client = useQueryClient();
  const order = useQuery({ queryKey: ['order', id], queryFn: async () => unwrap(await window.vetka.orders.get(id)) });
  const [tracking, setTracking] = useState('');
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['order', id] }); await client.invalidateQueries({ queryKey: ['orders'] }); };
  const transition = useMutation({ mutationFn: async (status: OrderStatus) => unwrap(await window.vetka.orders.transition(id, status)), onSuccess: refresh });
  const saveTracking = useMutation({ mutationFn: async () => unwrap(await window.vetka.orders.updateTracking(id, tracking)), onSuccess: refresh });
  if (!order.data) return <div className="p-6 text-sm text-muted-foreground">Загружаю заказ…</div>;
  const nextStatus = next[order.data.status];
  return <section className="flex flex-1 flex-col gap-6 p-6"><Button asChild variant="ghost" className="w-fit"><Link to="/orders"><ArrowLeftIcon />К заказам</Link></Button>
    <header className="flex items-end justify-between"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold">{order.data.customerContact}</h1><Badge>{labels[order.data.status]}</Badge></div><p className="text-sm text-muted-foreground">{order.data.dollName} · {order.data.sourceAsin}</p></div>{nextStatus && <Button onClick={() => transition.mutate(nextStatus)}><CheckCircle2Icon />{labels[nextStatus]}</Button>}</header>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Себестоимость</CardTitle><CardDescription>Зафиксирована в момент создания заказа</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Amazon</span><span>{formatMoney(order.data.sourcePriceMinor, order.data.sourceCurrency)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Доставка</span><span>{formatKzt(order.data.internationalShippingKztMinor)}</span></div><Separator /><div className="flex justify-between font-medium"><span>Итого</span><span>{formatKzt(order.data.totalCostKztMinor)}</span></div><div className="flex justify-between"><span>Цена клиенту</span><span>{formatKzt(order.data.customerPriceKztMinor)}</span></div><div className="flex justify-between"><span>Прибыль</span><span>{formatKzt(order.data.profitKztMinor)}</span></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Доставка</CardTitle><CardDescription>Трек-номер можно менять в любой момент</CardDescription></CardHeader><CardContent><div className="flex gap-2"><Input value={tracking || order.data.trackingNumber || ''} onChange={(event) => setTracking(event.target.value)} placeholder="Трек-номер" /><Button variant="secondary" onClick={() => saveTracking.mutate()}><TruckIcon />Сохранить</Button></div></CardContent></Card></div>
    <Card><CardHeader><CardTitle>История статусов</CardTitle></CardHeader><CardContent className="space-y-4">{order.data.events.map((event, index) => <div key={event.id} className="flex gap-3"><div className="mt-1 size-2 rounded-full bg-primary" /><div><p className="text-sm font-medium">{labels[event.nextStatus]}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString('ru-RU')}{event.comment ? ` · ${event.comment}` : ''}</p></div>{index < order.data!.events.length - 1 && <div />}</div>)}</CardContent></Card>
  </section>;
}
