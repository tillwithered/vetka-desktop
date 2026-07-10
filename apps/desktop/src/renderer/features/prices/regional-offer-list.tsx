import { ExternalLinkIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { freshnessAt } from '@/domain/freshness';
import { formatKzt, formatMoney } from '@/renderer/lib/ipc-query';
import type { AmazonRegion, CurrentPrice } from '@/shared/contracts';

const regions: Array<{ id: AmazonRegion; label: string }> = [
  { id: 'amazon_us', label: 'Amazon US' }, { id: 'amazon_uk', label: 'Amazon UK' },
  { id: 'amazon_de', label: 'Amazon DE' }, { id: 'amazon_es', label: 'Amazon ES' }, { id: 'amazon_it', label: 'Amazon IT' },
];

const freshnessLabel = { fresh: 'Свежая', aging: 'Давно', stale: 'Устарела' } as const;

export function RegionalOfferList({ prices }: { prices: CurrentPrice[] }) {
  return <div>{regions.map((region, index) => {
    const price = prices.find((item) => item.region === region.id);
    const freshness = price ? freshnessAt(price.checkedAt) : null;
    return <div key={region.id}>{index > 0 && <Separator />}<div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-medium">{region.label}</span>{freshness && <Badge variant={freshness === 'fresh' ? 'default' : 'secondary'}>{freshnessLabel[freshness]}</Badge>}{price?.latestCheckStatus && price.latestCheckStatus !== 'verified' && <Badge variant="destructive">{price.latestCheckStatus}</Badge>}</div>
        {price ? <><div className="mt-1 text-lg font-semibold">{formatMoney(price.priceMinor, price.currency)} <span className="text-sm font-normal text-muted-foreground">· {formatKzt(price.priceKztMinor)}</span></div><p className="truncate text-xs text-muted-foreground">{price.sellerName ?? 'Продавец не указан'} · {price.fulfilledByAmazon ? 'Amazon доставка' : 'сторонняя доставка'}</p></> : <p className="mt-1 text-sm text-muted-foreground">Нет подтверждённой цены</p>}
      </div>{price && <Button asChild size="icon-sm" variant="ghost"><a href={price.url} target="_blank" rel="noreferrer" aria-label={`Открыть ${region.label}`}><ExternalLinkIcon /></a></Button>}
    </div></div>;
  })}</div>;
}
