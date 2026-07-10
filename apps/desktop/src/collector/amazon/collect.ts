import type { AmazonRegion } from '@/shared/contracts';

import type { CollectorDollResult, CollectorRequest, CollectorStage } from '../contracts';
import { matchAmazonProduct } from './matching';
import { parseAmazonProductPage } from './product-page';
import { parseAmazonSearchResults } from './search';

export type CollectorDriver = {
  openProduct(region: AmazonRegion, url: string): Promise<string>;
  search(region: AmazonRegion, term: string): Promise<string>;
};

export async function collectDoll(
  request: CollectorRequest,
  driver: CollectorDriver,
  progress: (stage: CollectorStage, region?: AmazonRegion) => void,
): Promise<CollectorDollResult> {
  const result: CollectorDollResult = { requestId: request.requestId, regions: {} };

  for (const region of request.regions) {
    const listings = request.knownListings.filter((listing) => listing.region === region && listing.confirmed);
    let accepted = false;

    for (const listing of listings) {
      progress('checking', region);
      const page = parseAmazonProductPage(await driver.openProduct(region, listing.url), {
        region,
        expectedAsin: listing.asin,
      });
      result.regions[region] = { ...page, region, url: listing.url, reviewCandidates: [] };
      if (page.status === 'verified' || page.status === 'captcha_required') {
        if (page.status === 'captcha_required') progress('captcha_required', region);
        accepted = true;
        break;
      }
    }
    if (accepted) continue;

    const terms = [request.doll.mattelSku, request.doll.upcEan, request.doll.name]
      .filter((term): term is string => Boolean(term?.trim()))
      .slice(0, 3);
    const candidates = [];
    const seen = new Set<string>();
    for (const term of terms) {
      progress('searching', region);
      const found = parseAmazonSearchResults(await driver.search(region, term), region);
      for (const candidate of found) {
        if (!seen.has(candidate.asin) && candidates.length < 5) {
          candidates.push(candidate);
          seen.add(candidate.asin);
        }
      }
      if (candidates.length >= 5) break;
    }

    const reviewCandidates = candidates.filter((candidate) =>
      matchAmazonProduct(request.doll, candidate).status === 'needs_review',
    );
    result.regions[region] = {
      status: reviewCandidates.length > 0 ? 'no_price' : 'no_price',
      asin: null,
      title: null,
      regularPrice: null,
      primePrice: null,
      subscriptionPrice: null,
      couponText: null,
      seller: null,
      fulfilledByAmazon: false,
      availability: null,
      condition: null,
      region,
      url: null,
      reviewCandidates,
    };
  }

  progress('completed');
  return result;
}
