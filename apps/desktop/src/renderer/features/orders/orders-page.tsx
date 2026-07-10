import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageIcon, SearchIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatKzt, unwrap } from '@/renderer/lib/ipc-query';

const labels: Record<string, string> = { new: 'Новый', awaiting_payment: 'Ждём оплату', ordered: 'Заказан', shipped: 'Отправлен', warehouse: 'На складе', in_transit: 'В пути', received: 'Получен', delivered: 'Выдан' };

export function OrdersPage() {
  const [query, setQuery] = useState('');
  const orders = useQuery({ queryKey: ['orders', query], queryFn: async () => unwrap(await window.vetka.orders.list(query ? { query } : {})) });
  return <section className="flex flex-1 flex-col gap-6 p-6"><header><h1 className="text-2xl font-semibold">Заказы</h1><p className="text-sm text-muted-foreground">Контакты, себестоимость, доставка и статусы</p></header><Card><CardHeader><CardTitle>Все заказы</CardTitle><CardDescription>{orders.data?.length ?? 0} в локальной базе</CardDescription><div className="relative max-w-md pt-2"><SearchIcon className="absolute left-3 top-5 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Контакт, кукла или трек-номер" /></div></CardHeader><CardContent className="px-0">{orders.data?.length ? <Table><TableHeader><TableRow><TableHead>Клиент</TableHead><TableHead>Кукла</TableHead><TableHead>Статус</TableHead><TableHead>Сумма</TableHead><TableHead /></TableRow></TableHeader><TableBody>{orders.data.map((order) => <TableRow key={order.id}><TableCell className="font-medium">{order.customerContact}</TableCell><TableCell>{order.dollName}</TableCell><TableCell><Badge variant="secondary">{labels[order.status]}</Badge></TableCell><TableCell>{formatKzt(order.customerPriceKztMinor)}</TableCell><TableCell className="text-right"><Button asChild size="sm" variant="ghost"><Link to={`/orders/${order.id}`}>Открыть</Link></Button></TableCell></TableRow>)}</TableBody></Table> : <Empty><EmptyHeader><EmptyMedia variant="icon"><PackageIcon /></EmptyMedia><EmptyTitle>Заказов пока нет</EmptyTitle><EmptyDescription>Откройте куклу с подтверждённой ценой и создайте заказ.</EmptyDescription></EmptyHeader></Empty>}</CardContent></Card></section>;
}
