import type { DatabaseSync } from 'node:sqlite';

import type { CollectorClient } from '@/main/collector/client';
import type { AmazonRegion } from '@/shared/contracts';
import type { CatalogEntry } from '@/main/catalog/repository';
import type { AmazonCurrency } from '@/collector/amazon/regions';
import type { OfficialStoreDoll } from '@/collector/amazon/store';
import { amazonSearchEvidenceUrl } from '@/collector/amazon/regions';
import type { CatalogRegionEvidenceRepository, CatalogRegionEvidenceStatus } from '@/main/catalog/region-evidence-repository';

import type { PriceRepository, CheckStatus } from './repository';

type Dependencies = {
  db: DatabaseSync;
  prices: PriceRepository;
  regionEvidence?: CatalogRegionEvidenceRepository;
  collector: Pick<CollectorClient, 'refreshDoll'>;
  dataDir: string;
  getRate(currency: AmazonCurrency): number;
};

export class PriceService {
  constructor(private readonly dependencies: Dependencies) {}

  async refreshDoll(dollId: string, regions: AmazonRegion[]) {
    return this.refresh(dollId, regions);
  }

  async refreshCatalogEntry(entry: CatalogEntry, regions: AmazonRegion[]) {
    if (!entry.dollId) throw new Error('Catalog entry has no doll');
    return this.refresh(entry.dollId, regions, {
      mattelSku: entry.mattelSku,
      upcEan: null,
      searchQuery: entry.searchQuery,
      requiredTerms: entry.requiredTerms,
      rejectTerms: entry.rejectTerms,
    });
  }

  persistOfficialStoreOffer(dollId: string, offer: OfficialStoreDoll): void {
    const listing = this.dependencies.prices.ensureListing({
      dollId, region: offer.region, asin: offer.asin, url: offer.url,
      status: 'confirmed', confirmationSource: 'deterministic_match',
    });
    this.dependencies.prices.activateOfficialStoreListing(dollId, offer.region, listing.asin);
    this.dependencies.prices.applyCheck({
      listingId: listing.id, status: 'verified', checkedAt: new Date().toISOString(),
      diagnostic: { source: 'official_monster_high_store', mattelSku: offer.mattelSku },
      offer: {
        offerKind: 'regular', priceMinor: offer.price.minor, currency: offer.price.currency,
        shippingMinor: null, sellerName: offer.seller, fulfilledByAmazon: offer.fulfilledByAmazon,
        availability: offer.availability, condition: 'New', couponText: null,
        rateToKztMicros: this.dependencies.getRate(offer.price.currency),
      },
    });
    if (offer.imageUrl) this.dependencies.db.prepare("update dolls set image_path = coalesce(image_path, ?), image_source = case when image_path is null then 'amazon' else image_source end where id = ?").run(offer.imageUrl, dollId);
  }

  private async refresh(
    dollId: string,
    regions: AmazonRegion[],
    catalogRules?: { mattelSku: string; upcEan?: string | null; searchQuery?: string | null; requiredTerms: readonly string[]; rejectTerms: readonly string[] },
  ) {
    const doll = this.dependencies.db.prepare('select * from dolls where id = ?').get(dollId) as Record<string, unknown> | undefined;
    if (!doll) throw new Error('Doll not found');
    const effectiveCatalogRules = catalogRules
      ? { ...catalogRules, upcEan: doll.upc_ean === null ? null : String(doll.upc_ean) }
      : undefined;
    const listings = this.dependencies.prices.listListings(dollId);
    const knownListings = listings.filter((listing) => listing.status === 'confirmed').map((listing) => ({
      region: listing.region, asin: listing.asin, url: listing.url, confirmed: true,
    }));
    const knownRegions = new Set(knownListings.map((listing) => listing.region));
    const orderedRegions = [...regions].sort((left, right) => Number(knownRegions.has(right)) - Number(knownRegions.has(left)));
    const combined = { requestId: '', regions: {} };
    const regionErrors: string[] = [];

    for (const region of orderedRegions) {
      let result;
      try {
        result = await this.dependencies.collector.refreshDoll({
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
          knownListings,
          regions: [region],
          knownAsinsOnly: !effectiveCatalogRules,
          ...(effectiveCatalogRules ? { catalogRules: effectiveCatalogRules } : {}),
        });
      } catch (error) {
        if (catalogRules && this.dependencies.regionEvidence) {
          this.dependencies.regionEvidence.upsert({
            mattelSku: catalogRules.mattelSku, dollId, region, status: 'network_error', asin: null,
            evidenceUrl: amazonSearchEvidenceUrl(region, catalogRules.mattelSku), checkedAt: new Date().toISOString(),
            diagnostic: { message: error instanceof Error ? error.message.slice(0, 200) : 'collector failed' },
          });
        }
        regionErrors.push(`${region}: ${error instanceof Error ? error.message : 'collector failed'}`);
        continue;
      }
      if (!combined.requestId) combined.requestId = result.requestId;
      Object.assign(combined.regions, result.regions);

      for (const [resultRegion, regionResult] of Object.entries(result.regions) as Array<[AmazonRegion, NonNullable<(typeof result.regions)[AmazonRegion]>]>) {
      if (catalogRules && this.dependencies.regionEvidence) {
        this.dependencies.regionEvidence.upsert({
          mattelSku: catalogRules.mattelSku, dollId, region: resultRegion,
          status: regionResult.status as CatalogRegionEvidenceStatus,
          evidenceUrl: regionResult.evidenceUrl, asin: regionResult.asin,
          checkedAt: new Date().toISOString(), diagnostic: regionResult.matchDiagnostic ?? {},
        });
      }
      if (!catalogRules) for (const candidate of regionResult.reviewCandidates) {
        this.dependencies.prices.ensureListing({
          dollId, region: resultRegion, asin: candidate.asin, url: candidate.canonicalUrl, status: 'candidate',
          matchScore: 85, matchReasons: ['title_similarity'],
        });
      }
      if (!regionResult.asin || !regionResult.url) {
        const knownListing = listings.find((listing) => listing.region === resultRegion && listing.status === 'confirmed');
        if (knownListing) {
          this.dependencies.prices.applyCheck({
            listingId: knownListing.id,
            status: (regionResult.status === 'not_found' ? 'no_price' : regionResult.status) as CheckStatus,
            checkedAt: new Date().toISOString(),
            offer: null,
            diagnostic: regionResult.matchDiagnostic,
          });
        }
        continue;
      }
      const existingListing = this.dependencies.prices.getByIdentity(dollId, resultRegion, regionResult.asin);
      const listing = existingListing
        ? (catalogRules && existingListing.status !== 'confirmed' ? this.dependencies.prices.confirmDeterministicMatch(existingListing.id) : existingListing)
        : this.dependencies.prices.ensureListing({
          dollId,
          region: resultRegion,
          asin: regionResult.asin,
          url: regionResult.url,
          ...(catalogRules ? { status: 'confirmed' as const, confirmationSource: 'deterministic_match' as const } : {}),
        });
      const selected = regionResult.regularPrice ?? regionResult.primePrice ?? regionResult.subscriptionPrice;
      const offerKind = regionResult.regularPrice ? 'regular' : regionResult.primePrice ? 'prime' : 'subscription';
      this.dependencies.prices.applyCheck({
        listingId: listing.id,
        status: regionResult.status as CheckStatus,
        checkedAt: new Date().toISOString(),
        diagnostic: regionResult.matchDiagnostic,
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
      if (regionResult.status === 'verified' && regionResult.imageUrl) this.dependencies.db.prepare("update dolls set image_path = coalesce(image_path, ?), image_source = case when image_path is null then 'amazon' else image_source end where id = ?").run(regionResult.imageUrl, dollId);
    }
    }
    if (regionErrors.length > 0) throw new Error(regionErrors.join(' · '));
    return combined;
  }
}
