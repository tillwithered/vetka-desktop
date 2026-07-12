import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { HeartIcon } from 'lucide-react';

import { EmptyState } from '@/components/patterns/empty-state';
import { PageHeader } from '@/components/patterns/page-header';
import { StatCard } from '@/components/patterns/stat-card';
import { TableSurface } from '@/components/patterns/table-surface';
import { AddDollDialog } from '@/renderer/features/dolls/add-doll-dialog';
import { FavoritePriceTable } from './favorite-price-table';
import { unwrap } from '@/renderer/lib/ipc-query';
import { freshnessAt } from '@/domain/freshness';

export function HomePage() {
  const queryClient = useQueryClient();
  const dolls = useQuery({ queryKey: ['dolls', 'favorites'], queryFn: async () => unwrap(await window.vetka.dolls.list({ favoritesOnly: true })) });
  const priceQueries = useQueries({ queries: (dolls.data ?? []).map((doll) => ({ queryKey: ['prices', doll.id], queryFn: async () => unwrap(await window.vetka.prices.current(doll.id)) })) });
  const favorite = useMutation({ mutationFn: async (doll: NonNullable<typeof dolls.data>[number]) => unwrap(await window.vetka.dolls.setFavorite(doll.id, !doll.isFavorite)), onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['dolls'] }) });
  const priceChecksLoading = dolls.isLoading || priceQueries.some((query) => query.isLoading);
  const needsCheck = (dolls.data ?? []).filter((_, index) => {
    const query = priceQueries[index];
    const prices = query?.data ?? [];
    return query?.isError || prices.length === 0 || prices.some((price) => price.latestCheckStatus !== 'verified' || freshnessAt(price.checkedAt) === 'stale');
  }).length;
  const checkDetail = priceChecksLoading
    ? 'Сверяю свежесть цен'
    : needsCheck > 0
      ? 'Нет цены или данные старше суток'
      : 'Все цены актуальны';
  return <section className="flex flex-1 flex-col gap-6 p-6"><PageHeader title="Избранное" description="Куклы с ценами и быстрым переходом к заказу" actions={<AddDollDialog />} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><StatCard label="Избранных кукол" value={dolls.data?.length ?? 0} icon={HeartIcon} /><StatCard label="Нужна проверка" value={priceChecksLoading ? '—' : needsCheck} detail={checkDetail} /></div>{dolls.isLoading ? <div className="rounded-xl border p-6 text-sm text-muted-foreground">Загружаю рабочий список…</div> : dolls.data?.length ? <TableSurface><FavoritePriceTable dolls={dolls.data} onFavorite={(doll) => favorite.mutate(doll)} /></TableSurface> : <EmptyState icon={HeartIcon} title="Избранное пока пусто" description="Добавьте первую куклу или отметьте существующую сердцем." action={<AddDollDialog />} />}</section>;
}
