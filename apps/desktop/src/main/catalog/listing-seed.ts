import type { CatalogRepository } from './repository';
import type { PriceRepository } from '@/main/prices/repository';
import type { AmazonRegion } from '@/shared/contracts';
import { normalizeAmazonUrl } from '@/collector/amazon/url';

// Each seed is added only after a direct live check confirms both the ASIN and
// Mattel SKU on the Amazon product page. Discovery remains separate from this
// trusted-monitor list.
export type VerifiedAmazonListingSeed = {
  mattelSku: string;
  region: AmazonRegion;
  asin: string;
  url: string;
  verifiedAt: string;
};

export const verifiedAmazonListings: readonly VerifiedAmazonListingSeed[] = [
  {
    mattelSku: 'HXH76',
    region: 'amazon_es' as const,
    asin: 'B0CMGDLQC9',
    url: 'https://www.amazon.es/dp/B0CMGDLQC9',
    verifiedAt: '2026-07-12',
  },
] as const;

export function seedVerifiedAmazonListings(dependencies: {
  catalog: Pick<CatalogRepository, 'listAll'>;
  prices: Pick<PriceRepository, 'ensureListing'>;
}): void {
  const unique = new Set<string>();
  for (const listing of verifiedAmazonListings) {
    const normalized = normalizeAmazonUrl(listing.url);
    if (normalized.region !== listing.region || normalized.asin !== listing.asin) throw new Error('Invalid verified Amazon listing');
    const key = `${listing.mattelSku}:${listing.region}`;
    if (unique.has(key)) throw new Error('Duplicate verified Amazon listing');
    unique.add(key);
  }
  const entriesBySku = new Map(dependencies.catalog.listAll().map((entry) => [entry.mattelSku, entry]));
  for (const listing of verifiedAmazonListings) {
    const dollId = entriesBySku.get(listing.mattelSku)?.dollId;
    if (!dollId) continue;
    dependencies.prices.ensureListing({
      dollId,
      region: listing.region,
      asin: listing.asin,
      url: listing.url,
      status: 'confirmed',
      confirmationSource: 'exact_id',
      matchScore: 100,
      matchReasons: ['live_verified_sku_asin'],
    });
  }
}
