import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, CheckCircle2Icon, TruckIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { FormSection } from '@/components/patterns/form-section';
import { PageHeader } from '@/components/patterns/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { formatKzt, formatMoney, unwrap } from '@/renderer/lib/ipc-query';
import type { OrderStatus } from '@/shared/contracts';

const labels: Record<OrderStatus, string> = { new: 'Новый', awaiting_payment: 'Ждём оплату', ordered: 'Заказан', shipped: 'Отправлен', warehouse: 'На складе', in_transit: 'В пути', received: 'Получен', delivered: 'Выдан' };
const next: Partial<Record<OrderStatus, OrderStatus>> = { new: 'awaiting_payment', awaiting_payment: 'ordered', ordered: 'shipped', shipped: 'warehouse', warehouse: 'in_transit', in_transit: 'received', received: 'delivered' };

export function OrderDetailPage() {
  const { id = '' } = useParams(); const client = useQueryClient(); const order = useQuery({ queryKey: ['order', id], queryFn: async () => unwrap(await window.vetka.orders.get(id)) }); const [tracking, setTracking] = useState('');
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['order', id] }); await client.invalidateQueries({ queryKey: ['orders'] }); };
  const transition = useMutation({ mutationFn: async (status: OrderStatus) => unwrap(await window.vetka.orders.transition(id, status)), onSuccess: refresh }); const saveTracking = useMutation({ mutationFn: async () => unwrap(await window.vetka.orders.updateTracking(id, tracking)), onSuccess: refresh });
  if (!order.data) return <div className="p-6 text-sm text-muted-foreground">Загружаю заказ…</div>;
  const nextStatus = next[order.data.status];
  const rows = [['Amazon', formatMoney(order.data.sourcePriceMinor, order.data.sourceCurrency)], ['Доставка', formatKzt(order.data.internationalShippingKztMinor)], ['Итого', formatKzt(order.data.totalCostKztMinor)], ['Цена клиенту', formatKzt(order.data.customerPriceKztMinor)], ['Прибыль', formatKzt(order.data.profitKztMinor)]];
  return <section className="flex flex-1 flex-col gap-6 p-6"><Button asChild size="sm" variant="ghost" className="w-fit"><Link to="/orders"><ArrowLeftIcon />К заказам</Link></Button><PageHeader title={order.data.customerContact} description={`${order.data.dollName} · ${order.data.sourceAsin}`} meta={<Badge>{labels[order.data.status]}</Badge>} actions={nextStatus && <Button size="sm" onClick={() => transition.mutate(nextStatus)}><CheckCircle2Icon />{labels[nextStatus]}</Button>} /><div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]"><section className="rounded-xl border bg-card p-5"><h2 className="font-heading text-base font-medium">Себестоимость</h2><div className="mt-4 space-y-3 text-sm">{rows.map(([label, value], index) => <div key={label}>{index === 2 && <Separator className="mb-3" />}<div className={index === 2 ? 'flex justify-between font-medium' : 'flex justify-between'}><span className={index < 2 ? 'text-muted-foreground' : ''}>{label}</span><span>{value}</span></div></div>)}</div></section><FormSection title="Доставка" description="Трек-номер можно изменить в любой момент"><div className="flex max-w-xl gap-2"><Input aria-label="Трек-номер" value={tracking || order.data.trackingNumber || ''} onChange={(event) => setTracking(event.target.value)} placeholder="Трек-номер" /><Button size="sm" variant="secondary" onClick={() => saveTracking.mutate()}><TruckIcon />Сохранить</Button></div></FormSection></div><section className="max-w-4xl"><h2 className="font-heading text-base font-medium">История статусов</h2><div className="mt-4 space-y-4 border-l pl-5">{order.data.events.map((event) => <div key={event.id} className="relative"><span className="absolute -left-[1.45rem] top-1.5 size-2 rounded-full bg-primary" /><p className="text-sm font-medium">{labels[event.nextStatus]}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString('ru-RU')}{event.comment ? ` · ${event.comment}` : ''}</p></div>)}</div></section></section>;
}
