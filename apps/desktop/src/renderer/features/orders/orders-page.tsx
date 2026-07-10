import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageIcon, SearchIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/patterns/empty-state';
import { PageHeader } from '@/components/patterns/page-header';
import { PageToolbar } from '@/components/patterns/page-toolbar';
import { TableSurface } from '@/components/patterns/table-surface';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatKzt, unwrap } from '@/renderer/lib/ipc-query';

const labels: Record<string, string> = { new: 'Новый', awaiting_payment: 'Ждём оплату', ordered: 'Заказан', shipped: 'Отправлен', warehouse: 'На складе', in_transit: 'В пути', received: 'Получен', delivered: 'Выдан' };

export function OrdersPage() {
  const [query, setQuery] = useState('');
  const orders = useQuery({ queryKey: ['orders', query], queryFn: async () => unwrap(await window.vetka.orders.list(query ? { query } : {})) });
  return <section className="flex flex-1 flex-col gap-6 p-6"><PageHeader title="Заказы" description="Контакты, себестоимость, доставка и статусы" /><PageToolbar><div className="relative w-full max-w-md"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Поиск заказов" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Контакт, кукла или трек-номер" /></div><span className="text-sm text-muted-foreground">{orders.data?.length ?? 0} заказов</span></PageToolbar>{orders.isLoading ? <div className="rounded-xl border p-6 text-sm text-muted-foreground">Загружаю заказы…</div> : orders.data?.length ? <TableSurface><Table><TableHeader><TableRow><TableHead>Клиент</TableHead><TableHead>Кукла</TableHead><TableHead>Статус</TableHead><TableHead>Сумма</TableHead><TableHead /></TableRow></TableHeader><TableBody>{orders.data.map((order) => <TableRow key={order.id}><TableCell className="font-medium">{order.customerContact}</TableCell><TableCell>{order.dollName}</TableCell><TableCell><Badge variant="secondary">{labels[order.status]}</Badge></TableCell><TableCell>{formatKzt(order.customerPriceKztMinor)}</TableCell><TableCell className="text-right"><Button asChild size="sm" variant="ghost"><Link to={`/orders/${order.id}`}>Открыть</Link></Button></TableCell></TableRow>)}</TableBody></Table></TableSurface> : <EmptyState icon={PackageIcon} title={query ? 'Заказы не найдены' : 'Заказов пока нет'} description={query ? 'Попробуйте изменить запрос.' : 'Откройте куклу с подтверждённой ценой и создайте заказ.'} />}</section>;
}
