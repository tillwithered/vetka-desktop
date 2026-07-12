import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GemIcon, SearchIcon } from 'lucide-react';

import { EmptyState } from '@/components/patterns/empty-state';
import { PageHeader } from '@/components/patterns/page-header';
import { PageToolbar } from '@/components/patterns/page-toolbar';
import { TableSurface } from '@/components/patterns/table-surface';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { unwrap } from '@/renderer/lib/ipc-query';
import { CollectiblesScanStatus } from './collectibles-scan-status';
import { CollectiblesTable } from './collectibles-table';

export function CollectiblesPage() {
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState('');
  const client = useQueryClient();
  const items = useQuery({ queryKey: ['collectibles', archived, query], queryFn: async () => unwrap(await window.vetka.collectibles.list({ archived, ...(query ? { query } : {}) })) });
  const scan = useQuery({ queryKey: ['collectibles-scan-state'], queryFn: async () => unwrap(await window.vetka.collectibles.getScanState()) });
  const refresh = useMutation({
    mutationFn: async () => unwrap(await window.vetka.collectibles.refreshNow()),
    onSuccess: async (state) => {
      client.setQueryData(['collectibles-scan-state'], state);
      await client.invalidateQueries({ queryKey: ['collectibles'] });
    },
  });

  useEffect(() => window.vetka.collectibles.onScanStateChanged((state) => {
    client.setQueryData(['collectibles-scan-state'], state);
    if (state.status === 'idle') void client.invalidateQueries({ queryKey: ['collectibles'] });
  }), [client]);

  return <section className="flex min-w-0 flex-1 flex-col gap-6 p-6">
    <PageHeader title="Коллекционки" description="Актуальные и архивные релизы Monster High с Mattel Creations" />
    <CollectiblesScanStatus state={scan.data} pending={refresh.isPending} onRefresh={() => refresh.mutate()} />
    <PageToolbar>
      <Tabs value={archived ? 'archive' : 'active'} onValueChange={(value) => setArchived(value === 'archive')}><TabsList><TabsTrigger value="active">Актуальные</TabsTrigger><TabsTrigger value="archive">Архив</TabsTrigger></TabsList></Tabs>
      <div className="relative w-full max-w-md"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Поиск коллекционок" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, серия или SKU" /></div>
      <span className="text-sm text-muted-foreground">{items.data?.length ?? 0} карточек</span>
    </PageToolbar>
    {(items.error || refresh.error) && <Alert variant="destructive"><AlertTitle>Не удалось загрузить коллекционки</AlertTitle><AlertDescription>Последние сохранённые данные останутся в каталоге.</AlertDescription></Alert>}
    {items.isLoading ? <TableSurface><div className="space-y-3 p-4"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div></TableSurface>
      : items.data?.length ? <TableSurface className="min-w-0 max-w-full"><CollectiblesTable items={items.data} /></TableSurface>
        : <EmptyState icon={GemIcon} title={query ? 'Ничего не найдено' : archived ? 'Архив пока пуст' : 'Коллекционок пока нет'} description={query ? 'Измените поисковый запрос.' : 'Нажмите «Обновить сейчас», чтобы получить официальный каталог Mattel Creations.'} />}
  </section>;
}
