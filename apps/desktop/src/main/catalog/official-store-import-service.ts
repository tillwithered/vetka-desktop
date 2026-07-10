import type { AmazonRegion } from '@/shared/contracts';
import { BrowserCollectorDriver } from '@/collector/browser';
import { parseAmazonStoreLinks, parseOfficialStoreDoll } from '@/collector/amazon/store';

import type { CatalogRepository } from './repository';
import type { PriceService } from '@/main/prices/service';

const storeUrls: Record<AmazonRegion, string> = {
  amazon_us: 'https://www.amazon.com/stores/MonsterHigh/page/8153CA24-16BD-4D5B-B6FD-FAB40CBF9D55',
  amazon_uk: 'https://www.amazon.co.uk/stores/MonsterHigh/page/F08243CA-36AF-405B-B3CF-BF5EA9644BBE',
  amazon_de: 'https://www.amazon.de/stores/MonsterHigh/page/5E7E208A-1FAE-46F1-9E9B-1EC19E18108F',
  amazon_es: 'https://www.amazon.es/stores/MonsterHigh/page/497AFA99-E38B-4DBC-9BEC-0751E198AA35',
  amazon_it: 'https://www.amazon.it/stores/MonsterHigh/page/38828C3D-2177-488D-9D09-F758976215AF',
};

type StoreDriver = Pick<BrowserCollectorDriver, 'openStore' | 'openProduct' | 'close'>;

export class OfficialStoreImportService {
  constructor(private readonly dependencies: {
    catalog: Pick<CatalogRepository, 'getBySku' | 'importSeed'>;
    prices: unknown;
    priceService: Pick<PriceService, 'persistOfficialStoreOffer'>;
    driver: StoreDriver;
    now?: () => Date;
  }) {}

  async run(regions: readonly AmazonRegion[]): Promise<{ imported: number; updated: number; skipped: number }> {
    let imported = 0; let updated = 0; let skipped = 0;
    const checkedAt = (this.dependencies.now?.() ?? new Date()).toISOString().slice(0, 10);
    try {
      for (const region of regions) {
        const links = parseAmazonStoreLinks(await this.dependencies.driver.openStore(region, storeUrls[region]), region);
        for (const link of links) {
          const doll = parseOfficialStoreDoll(await this.dependencies.driver.openProduct(region, link.url), region, link.url);
          if (!doll) { skipped += 1; continue; }
          const existing = this.dependencies.catalog.getBySku(doll.mattelSku);
          this.dependencies.catalog.importSeed([{
            mattelSku: doll.mattelSku, name: doll.name.slice(0, 160), characterName: null, lineName: null,
            productType: 'official_store', monitorStatus: 'monitor_only', requiredTerms: [doll.mattelSku], rejectTerms: ['accessory', 'replacement', 'outfit'],
            searchQuery: `Monster High ${doll.mattelSku}`, sourceUrl: doll.url, sourceCheckedAt: checkedAt,
            evidence: 'Official Monster High Amazon Store',
          }]);
          const entry = this.dependencies.catalog.getBySku(doll.mattelSku);
          if (!entry?.dollId) throw new Error('Official Store import did not create a doll');
          this.dependencies.priceService.persistOfficialStoreOffer(entry.dollId, doll);
          if (existing) updated += 1;
          else imported += 1;
        }
      }
      return { imported, updated, skipped };
    } finally {
      await this.dependencies.driver.close();
    }
  }
}
