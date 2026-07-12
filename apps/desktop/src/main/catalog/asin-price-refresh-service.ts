import type { AmazonRegion } from '@/shared/contracts';
import type { CatalogEntry, CatalogRepository } from './repository';
import type { PriceRepository } from '@/main/prices/repository';
import type { PriceService } from '@/main/prices/service';

export class AsinPriceRefreshService {
  constructor(private readonly dependencies: {
    catalog: Pick<CatalogRepository, 'listAll'>;
    prices: Pick<PriceRepository, 'listDollIdsWithConfirmedListings'>;
    priceService: Pick<PriceService, 'refreshCatalogEntry' | 'refreshDoll'>;
  }) {}

  async run(
    regions: readonly AmazonRegion[],
    onProgress?: (event: { processed: number; total: number; dollId: string; entry: CatalogEntry | null }) => void,
  ): Promise<{ processed: number; total: number; errors: string[] }> {
    const catalogEntries = this.dependencies.catalog.listAll();
    const entriesByDollId = new Map(catalogEntries
      .filter((entry): entry is CatalogEntry & { dollId: string } => entry.dollId !== null)
      .map((entry) => [entry.dollId, entry]));
    const confirmedDollIds = this.dependencies.prices.listDollIdsWithConfirmedListings();
    const confirmed = new Set(confirmedDollIds);
    const activeDollIds = catalogEntries
      .filter((entry): entry is CatalogEntry & { dollId: string } => entry.monitorStatus === 'active' && entry.dollId !== null)
      .map((entry) => entry.dollId);
    const dollIds = [...confirmedDollIds, ...activeDollIds.filter((dollId) => !confirmed.has(dollId))];
    const errors: string[] = [];

    for (const [index, dollId] of dollIds.entries()) {
      const entry = entriesByDollId.get(dollId) ?? null;
      try {
        if (entry) await this.dependencies.priceService.refreshCatalogEntry(entry, [...regions]);
        else await this.dependencies.priceService.refreshDoll(dollId, [...regions]);
      } catch {
        errors.push(`${entry?.mattelSku ?? dollId}: price refresh failed`);
      }
      onProgress?.({ processed: index + 1, total: dollIds.length, dollId, entry });
    }

    return { processed: dollIds.length, total: dollIds.length, errors };
  }
}
