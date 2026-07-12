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
    const entriesByDollId = new Map(this.dependencies.catalog.listAll()
      .filter((entry): entry is CatalogEntry & { dollId: string } => entry.dollId !== null)
      .map((entry) => [entry.dollId, entry]));
    const dollIds = this.dependencies.prices.listDollIdsWithConfirmedListings();
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
