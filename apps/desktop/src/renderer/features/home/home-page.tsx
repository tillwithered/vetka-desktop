import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangleIcon, HeartIcon, TrendingDownIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { AddDollDialog } from '@/renderer/features/dolls/add-doll-dialog';
import { DollTable } from '@/renderer/features/dolls/doll-table';
import { unwrap } from '@/renderer/lib/ipc-query';

export function HomePage() {
  const queryClient = useQueryClient();
  const dolls = useQuery({ queryKey: ['dolls', 'favorites'], queryFn: async () => unwrap(await window.vetka.dolls.list({ favoritesOnly: true })) });
  const favorite = useMutation({
    mutationFn: async (doll: NonNullable<typeof dolls.data>[number]) => unwrap(await window.vetka.dolls.setFavorite(doll.id, !doll.isFavorite)),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['dolls'] }),
  });
  const reviewCount = 0;

  return (
    <section className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div><h1 className="font-heading text-2xl font-semibold">Избранное</h1><p className="text-sm text-muted-foreground">Куклы, цены и быстрый переход к заказу</p></div>
        <AddDollDialog />
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardDescription>Избранных кукол</CardDescription><CardTitle className="text-3xl">{dolls.data?.length ?? 0}</CardTitle></div><HeartIcon className="text-muted-foreground" /></CardHeader></Card>
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardDescription>Снижение цены</CardDescription><CardTitle className="text-3xl">0</CardTitle></div><TrendingDownIcon className="text-emerald-500" /></CardHeader></Card>
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardDescription>Нужно проверить</CardDescription><CardTitle className="text-3xl">{reviewCount}</CardTitle></div><AlertTriangleIcon className="text-amber-500" /></CardHeader></Card>
      </div>
      <Card className="min-h-72">
        <CardHeader><CardTitle>Рабочий список</CardTitle><CardDescription>Актуальность цены всегда видна рядом с регионом.</CardDescription></CardHeader>
        <CardContent className="px-0">
          {dolls.isLoading ? <div className="space-y-3 px-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : dolls.data?.length ? <DollTable dolls={dolls.data} onFavorite={(doll) => favorite.mutate(doll)} /> : <Empty><EmptyHeader><EmptyMedia variant="icon"><HeartIcon /></EmptyMedia><EmptyTitle>Избранное пока пусто</EmptyTitle><EmptyDescription>Добавьте первую куклу или отметьте существующую сердцем.</EmptyDescription></EmptyHeader><AddDollDialog /></Empty>}
        </CardContent>
      </Card>
    </section>
  );
}
