import type { DatabaseSync } from 'node:sqlite';

import type { CollectorClient } from '@/main/collector/client';
import type { AmazonRegion } from '@/shared/contracts';

import type { PriceRepository, CheckStatus } from './repository';

type Dependencies = {
  db: DatabaseSync;
  prices: PriceRepository;
  collector: Pick<CollectorClient, 'refreshDoll'>;
  dataDir: string;
  getRate(currency: 'USD' | 'GBP' | 'EUR'): number;
};

export class PriceService {
  constructor(private readonly dependencies: Dependencies) {}

  async refreshDoll(dollId: string, regions: AmazonRegion[]) {
    const doll = this.dependencies.db.prepare('select * from dolls where id = ?').get(dollId) as Record<string, unknown> | undefined;
    if (!doll) throw new Error('Doll not found');
    const listings = this.dependencies.prices.listListings(dollId);
    const result = await this.dependencies.collector.refreshDoll({
      dataDir: this.dependencies.dataDir,
      doll: {
        id: dollId,
        name: String(doll.name),
        characterName: doll.character_name === null ? null : String(doll.character_name),
        lineName: doll.line_name === null ? null : String(doll.line_name),
        generation: doll.generation === null ? null : String(doll.generation),
        mattelSku: doll.mattel_sku === null ? null : String(doll.mattel_sku),
        upcEan: doll.upc_ean === null ? null : String(doll.upc_ean),
      },
      knownListings: listings.filter((listing) => listing.status === 'confirmed').map((listing) => ({
        region: listing.region, asin: listing.asin, url: listing.url, confirmed: true,
      })),
      regions,
    });

    for (const [region, regionResult] of Object.entries(result.regions) as Array<[AmazonRegion, NonNullable<(typeof result.regions)[AmazonRegion]>]>) {
      for (const candidate of regionResult.reviewCandidates) {
        this.dependencies.prices.ensureListing({
          dollId, region, asin: candidate.asin, url: candidate.canonicalUrl, status: 'candidate',
          matchScore: 85, matchReasons: ['title_similarity'],
        });
      }
      if (!regionResult.asin || !regionResult.url) continue;
      const listing = this.dependencies.prices.getByIdentity(dollId, region, regionResult.asin)
        ?? this.dependencies.prices.ensureListing({ dollId, region, asin: regionResult.asin, url: regionResult.url });
      const selected = regionResult.regularPrice ?? regionResult.primePrice ?? regionResult.subscriptionPrice;
      const offerKind = regionResult.regularPrice ? 'regular' : regionResult.primePrice ? 'prime' : 'subscription';
      this.dependencies.prices.applyCheck({
        listingId: listing.id,
        status: regionResult.status as CheckStatus,
        checkedAt: new Date().toISOString(),
        offer: regionResult.status === 'verified' && selected && regionResult.condition === 'New' && regionResult.availability && regionResult.availability !== 'out_of_stock'
          ? {
              offerKind,
              priceMinor: selected.minor,
              currency: selected.currency,
              shippingMinor: null,
              sellerName: regionResult.seller,
              fulfilledByAmazon: regionResult.fulfilledByAmazon,
              availability: regionResult.availability,
              condition: 'New',
              couponText: regionResult.couponText,
              rateToKztMicros: this.dependencies.getRate(selected.currency),
            }
          : null,
      });
    }
    return result;
  }
}
