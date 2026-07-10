import type { AmazonRegion } from '@/shared/contracts';
import type { CollectorClient, CollectorProgressEvent } from '@/main/collector/client';

import type { CatalogRepository } from './repository';
import type { PriceService } from '@/main/prices/service';

type StoreCollector = Pick<CollectorClient, 'importOfficialStore'>;

export class OfficialStoreImportService {
  constructor(private readonly dependencies: {
    catalog: Pick<CatalogRepository, 'getBySku' | 'importSeed'>;
    priceService: Pick<PriceService, 'persistOfficialStoreOffer'>;
    collector: StoreCollector;
    dataDir: string;
    now?: () => Date;
  }) {}

  async run(regions: readonly AmazonRegion[], onProgress?: (event: { region: AmazonRegion; processed: number; total: number }) => void): Promise<{ imported: number; updated: number; skipped: number; errors?: string[] }> {
    let imported = 0; let updated = 0; let skipped = 0;
    const errors: string[] = [];
    const checkedAt = (this.dependencies.now?.() ?? new Date()).toISOString().slice(0, 10);
    const progress = (event: CollectorProgressEvent) => {
      if (!event.region) return;
      onProgress?.({ region: event.region as AmazonRegion, processed: event.processed ?? 0, total: event.total ?? 0 });
    };
    const collected = await this.dependencies.collector.importOfficialStore({ dataDir: this.dependencies.dataDir, regions: [...regions] }, progress);
    for (const region of regions) {
      const outcome = collected.regions[region];
      if (outcome && outcome.status !== 'completed') errors.push(`${region}: ${outcome.error ?? outcome.status}`);
    }
    for (const doll of collected.products) {
      const existing = this.dependencies.catalog.getBySku(doll.mattelSku);
      this.dependencies.catalog.importSeed([{
        mattelSku: doll.mattelSku, name: doll.name.slice(0, 160), characterName: null, lineName: null,
        productType: 'official_store', monitorStatus: 'active', requiredTerms: [doll.mattelSku], rejectTerms: ['accessory', 'replacement', 'outfit'],
        searchQuery: `Monster High ${doll.mattelSku}`, sourceUrl: doll.url, sourceCheckedAt: checkedAt,
        evidence: 'Official Monster High Amazon Store',
      }]);
      const entry = this.dependencies.catalog.getBySku(doll.mattelSku);
      if (!entry?.dollId) throw new Error('Official Store import did not create a doll');
      this.dependencies.priceService.persistOfficialStoreOffer(entry.dollId, doll);
      if (existing) updated += 1;
      else imported += 1;
    }
    skipped = Object.values(collected.regions).reduce((count, outcome) => count + (outcome?.status === 'completed' ? 0 : outcome?.total ?? 0), 0);
    return errors.length > 0 ? { imported, updated, skipped, errors } : { imported, updated, skipped };
  }
}
