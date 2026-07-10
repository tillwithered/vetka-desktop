import type { CatalogRepository } from './repository';
import type { PriceRepository } from '@/main/prices/repository';

// Each seed is added only after a direct live check confirms both the ASIN and
// Mattel SKU on the Amazon product page. Discovery remains separate from this
// trusted-monitor list.
const verifiedListings = [
  {
    mattelSku: 'HXH76',
    region: 'amazon_es' as const,
    asin: 'B0CMGDLQC9',
    url: 'https://www.amazon.es/dp/B0CMGDLQC9',
  },
] as const;

export function seedVerifiedAmazonListings(dependencies: {
  catalog: Pick<CatalogRepository, 'listAll'>;
  prices: Pick<PriceRepository, 'ensureListing'>;
}): void {
  const entriesBySku = new Map(dependencies.catalog.listAll().map((entry) => [entry.mattelSku, entry]));
  for (const listing of verifiedListings) {
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
