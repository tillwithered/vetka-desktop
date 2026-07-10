import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchIcon } from 'lucide-react';

import { EmptyState } from '@/components/patterns/empty-state';
import { PageHeader } from '@/components/patterns/page-header';
import { PageToolbar } from '@/components/patterns/page-toolbar';
import { TableSurface } from '@/components/patterns/table-surface';
import { Input } from '@/components/ui/input';
import { unwrap } from '@/renderer/lib/ipc-query';
import { AddDollDialog } from './add-doll-dialog';
import { CatalogScanStatus } from './catalog-scan-status';
import { DollTable } from './doll-table';

export function DollsPage() {
  const [query, setQuery] = useState('');
  const client = useQueryClient();
  const dolls = useQuery({ queryKey: ['dolls', query], queryFn: async () => unwrap(await window.vetka.dolls.list(query ? { query } : {})) });
  const favorite = useMutation({
    mutationFn: async (doll: NonNullable<typeof dolls.data>[number]) => unwrap(await window.vetka.dolls.setFavorite(doll.id, !doll.isFavorite)),
    onSuccess: async () => client.invalidateQueries({ queryKey: ['dolls'] }),
  });

  return <section className="flex flex-1 flex-col gap-6 p-6">
    <PageHeader title="Куклы" description="Рабочий список Amazon и ручные карточки" actions={<AddDollDialog />} />
    <CatalogScanStatus />
    <PageToolbar>
      <div className="relative w-full max-w-md"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Поиск кукол" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, персонаж, SKU или UPC" /></div>
      <span className="text-sm text-muted-foreground">{dolls.data?.length ?? 0} карточек</span>
    </PageToolbar>
    {dolls.isLoading ? <div className="rounded-xl border p-6 text-sm text-muted-foreground">Загружаю каталог…</div>
      : dolls.data?.length ? <TableSurface><DollTable dolls={dolls.data} onFavorite={(doll) => favorite.mutate(doll)} /></TableSurface>
        : <EmptyState title={query ? 'Ничего не найдено' : 'Каталог пока пуст'} description={query ? 'Попробуйте изменить запрос.' : 'Добавьте первую куклу, чтобы начать отслеживать цены.'} action={!query ? <AddDollDialog /> : undefined} />}
  </section>;
}
