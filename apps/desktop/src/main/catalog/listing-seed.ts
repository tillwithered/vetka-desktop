import type { CatalogRepository } from './repository';
import type { PriceRepository } from '@/main/prices/repository';
import type { AmazonRegion } from '@/shared/contracts';
import { normalizeAmazonUrl } from '@/collector/amazon/url';

// Seeds are promoted from confirmed listings in the production catalog. At
// least one regional page for each ASIN has passed the identity/price parser;
// only regions already observed by the application are included here.
export type VerifiedAmazonListingSeed = {
  mattelSku: string;
  region: AmazonRegion;
  asin: string;
  url: string;
  verifiedAt: string;
};

const allRegions = ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'] as const satisfies readonly AmazonRegion[];
const domains: Record<AmazonRegion, string> = {
  amazon_us: 'www.amazon.com',
  amazon_uk: 'www.amazon.co.uk',
  amazon_de: 'www.amazon.de',
  amazon_es: 'www.amazon.es',
  amazon_it: 'www.amazon.it',
};

const products: readonly { mattelSku: string; asin: string; regions: readonly AmazonRegion[] }[] = [
  { mattelSku: 'HXH76', asin: 'B0CMGDLQC9', regions: allRegions },
  { mattelSku: 'HYV64', asin: 'B0D7PTM9VR', regions: allRegions },
  { mattelSku: 'JHK29', asin: 'B0FDH4G8TV', regions: allRegions },
  { mattelSku: 'JHK30', asin: 'B0FDH1BBCK', regions: allRegions },
  { mattelSku: 'JHK31', asin: 'B0FDH2BVXH', regions: allRegions },
  { mattelSku: 'JHK33', asin: 'B0FDH3G8X7', regions: allRegions },
  { mattelSku: 'JHK34', asin: 'B0FFTBPVKT', regions: allRegions },
  { mattelSku: 'JDR50', asin: 'B0F96LCM84', regions: ['amazon_de', 'amazon_es', 'amazon_it'] },
  { mattelSku: 'JDR51', asin: 'B0F97B4VSR', regions: ['amazon_us', 'amazon_de', 'amazon_es', 'amazon_it'] },
  { mattelSku: 'JDR52', asin: 'B0F974HHQ8', regions: ['amazon_us', 'amazon_de', 'amazon_es', 'amazon_it'] },
  { mattelSku: 'JHK58', asin: 'B0FK18MKKJ', regions: allRegions },
  { mattelSku: 'JHK59', asin: 'B0FK1V67X5', regions: allRegions },
  { mattelSku: 'JMB92', asin: 'B0G43YKFL4', regions: allRegions },
  { mattelSku: 'JNM26', asin: 'B0G43P5JG8', regions: allRegions },
  { mattelSku: 'JMB89', asin: 'B0G43TFK86', regions: allRegions },
  { mattelSku: 'JMB91', asin: 'B0G43YY3Y7', regions: allRegions },
  { mattelSku: 'JMB90', asin: 'B0G43X7594', regions: ['amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'] },
  { mattelSku: 'JHK46', asin: 'B0G44LN98J', regions: allRegions },
  { mattelSku: 'JHK57', asin: 'B0FK1NN8N5', regions: allRegions },
  { mattelSku: 'JKD76', asin: 'B0G43TN8YC', regions: allRegions },
  { mattelSku: 'JMB81', asin: 'B0FJZYDKX9', regions: allRegions },
  { mattelSku: 'JMG65', asin: 'B0G27XGD8G', regions: ['amazon_de', 'amazon_es', 'amazon_it'] },
  { mattelSku: 'JMG66', asin: 'B0G27VB4Z7', regions: ['amazon_de', 'amazon_es', 'amazon_it'] },
  { mattelSku: 'JMG73', asin: 'B0G28B9NGD', regions: allRegions },
  { mattelSku: 'JMG74', asin: 'B0G27W9XKV', regions: allRegions },
];

export const verifiedAmazonListings: readonly VerifiedAmazonListingSeed[] = products.flatMap((product) => product.regions.map((region) => ({
  mattelSku: product.mattelSku,
  region,
  asin: product.asin,
  url: `https://${domains[region]}/dp/${product.asin}`,
  verifiedAt: '2026-07-12',
})));

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
