import type { DatabaseSync } from 'node:sqlite';

import { amazonSearchEvidenceUrl } from '@/collector/amazon/regions';
import type { PriceRepository } from '@/main/prices/repository';
import type { AmazonRegion, RegionalPriceState } from '@/shared/contracts';
import { isPriceCheckOverdue } from '@/domain/freshness';

import type { CatalogRegionEvidenceRepository } from './region-evidence-repository';

export const catalogAmazonRegions: readonly AmazonRegion[] = [
  'amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it',
];

export class CatalogRegionStateService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: {
    db: DatabaseSync;
    evidence: CatalogRegionEvidenceRepository;
    prices: PriceRepository;
    now?: () => Date;
  }) {
    this.now = dependencies.now ?? (() => new Date());
  }

  list(dollId: string): RegionalPriceState[] {
    const identity = this.dependencies.db.prepare(`
      select coalesce(c.mattel_sku, d.mattel_sku) as mattel_sku
      from dolls d left join catalog_entries c on c.doll_id = d.id
      where d.id = ?
    `).get(dollId) as { mattel_sku: string | null } | undefined;
    if (!identity) throw new Error('Doll not found');
    const sku = identity.mattel_sku ?? '';
    const evidenceByRegion = new Map(this.dependencies.evidence.listForDoll(dollId).map((item) => [item.region, item]));
    const pricesByRegion = new Map(this.dependencies.prices.current(dollId).map((price) => [price.region, price]));
    const now = this.now();

    return catalogAmazonRegions.map((region) => {
      const evidence = evidenceByRegion.get(region);
      return {
        region,
        status: evidence?.status ?? 'unchecked',
        evidenceUrl: evidence?.evidenceUrl ?? amazonSearchEvidenceUrl(region, sku),
        asin: evidence?.asin ?? null,
        checkedAt: evidence?.checkedAt ?? null,
        currentPrice: evidence?.status === 'verified' ? pricesByRegion.get(region) ?? null : null,
        overdue: Boolean(evidence && isPriceCheckOverdue(evidence.checkedAt, now)),
      };
    });
  }
}
