import type { AmazonRegion } from '@/shared/contracts';
import type { CatalogEntry, CatalogRepository } from './repository';
import type { PriceRepository } from '@/main/prices/repository';
import type { PriceService } from '@/main/prices/service';

export class AsinPriceRefreshService {
  constructor(private readonly dependencies: {
    catalog: Pick<CatalogRepository, 'listActive'>;
    prices: Pick<PriceRepository, 'listListings'>;
    priceService: Pick<PriceService, 'refreshCatalogEntry'>;
  }) {}

  async run(
    regions: readonly AmazonRegion[],
    onProgress?: (event: { processed: number; total: number; entry: CatalogEntry }) => void,
  ): Promise<{ processed: number; total: number; errors: string[] }> {
    const entries = this.dependencies.catalog.listActive().filter((entry) => (
      entry.dollId !== null
      && this.dependencies.prices.listListings(entry.dollId).some((listing) => listing.status === 'confirmed')
    ));
    const errors: string[] = [];

    for (const [index, entry] of entries.entries()) {
      try {
        await this.dependencies.priceService.refreshCatalogEntry(entry, [...regions]);
      } catch {
        errors.push(`${entry.mattelSku}: price refresh failed`);
      }
      onProgress?.({ processed: index + 1, total: entries.length, entry });
    }

    return { processed: entries.length, total: entries.length, errors };
  }
}
