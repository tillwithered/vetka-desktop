import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AddDollDialog } from './add-doll-dialog';
import { DollTable } from './doll-table';
import { unwrap } from '@/renderer/lib/ipc-query';

export function DollsPage() {
  const [query, setQuery] = useState('');
  const client = useQueryClient();
  const dolls = useQuery({ queryKey: ['dolls', query], queryFn: async () => unwrap(await window.vetka.dolls.list(query ? { query } : {})) });
  const favorite = useMutation({ mutationFn: async (doll: NonNullable<typeof dolls.data>[number]) => unwrap(await window.vetka.dolls.setFavorite(doll.id, !doll.isFavorite)), onSuccess: async () => client.invalidateQueries({ queryKey: ['dolls'] }) });
  return <section className="flex flex-1 flex-col gap-6 p-6">
    <header className="flex items-end justify-between"><div><h1 className="text-2xl font-semibold">Куклы</h1><p className="text-sm text-muted-foreground">Рабочий список Amazon и ручные карточки</p></div><AddDollDialog /></header>
    <Card><CardHeader><CardTitle>Все куклы</CardTitle><CardDescription>{dolls.data?.length ?? 0} карточек в локальной базе</CardDescription><div className="relative max-w-md pt-2"><SearchIcon className="absolute left-3 top-5 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, персонаж, SKU или UPC" /></div></CardHeader><CardContent className="px-0">{dolls.data?.length ? <DollTable dolls={dolls.data} onFavorite={(doll) => favorite.mutate(doll)} /> : <p className="px-6 py-12 text-center text-sm text-muted-foreground">Ничего не найдено</p>}</CardContent></Card>
  </section>;
}
