import { HeartIcon, MoreHorizontalIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Doll } from '@/shared/contracts';

export function DollTable({ dolls, onFavorite }: { dolls: Doll[]; onFavorite(doll: Doll): void }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Кукла</TableHead><TableHead>Линейка</TableHead><TableHead>Артикул</TableHead><TableHead className="w-24 text-right">Действия</TableHead></TableRow></TableHeader>
      <TableBody>
        {dolls.map((doll) => (
          <TableRow key={doll.id}>
            <TableCell>
              <Link className="font-medium hover:underline" to={`/dolls/${doll.id}`}>{doll.name}</Link>
              {doll.characterName && <div className="text-xs text-muted-foreground">{doll.characterName}</div>}
            </TableCell>
            <TableCell>{doll.lineName ? <Badge variant="secondary">{doll.lineName}{doll.generation ? ` · ${doll.generation}` : ''}</Badge> : '—'}</TableCell>
            <TableCell className="font-mono text-xs">{doll.mattelSku ?? doll.upcEan ?? '—'}</TableCell>
            <TableCell className="text-right">
              <Button size="icon-sm" variant={doll.isFavorite ? 'secondary' : 'ghost'} aria-label={doll.isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'} onClick={() => onFavorite(doll)}><HeartIcon className={doll.isFavorite ? 'fill-current' : ''} /></Button>
              <Button asChild size="icon-sm" variant="ghost"><Link to={`/dolls/${doll.id}`} aria-label="Открыть карточку"><MoreHorizontalIcon /></Link></Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
