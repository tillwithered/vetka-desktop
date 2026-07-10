import type { AmazonRegion } from '@/shared/contracts';

import type { CollectorDollResult, CollectorRequest, CollectorStage } from '../contracts';
import { matchAmazonProduct, matchCatalogOffer } from './matching';
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
      const html = await driver.openProduct(region, listing.url);
      const page = parseAmazonProductPage(html, {
        region,
        expectedAsin: listing.asin,
      });
      let matchDiagnostic;
      if (page.status === 'verified' && request.catalogRules) {
        const match = matchCatalogOffer(request.catalogRules, {
          title: page.title,
          evidenceText: `${page.title ?? ''} ${html}`,
          condition: page.condition,
        });
        matchDiagnostic = match;
        if (match.status !== 'verified') continue;
      }
      result.regions[region] = { ...page, region, url: listing.url, reviewCandidates: [], ...(matchDiagnostic ? { matchDiagnostic } : {}) };
      if (page.status === 'verified' || page.status === 'captcha_required') {
        if (page.status === 'captcha_required') progress('captcha_required', region);
        accepted = true;
        break;
      }
    }
    if (accepted) continue;

    const terms = request.catalogRules ? [request.catalogRules.requiredTerms.join(' '), request.doll.name, request.catalogRules.mattelSku, request.catalogRules.upcEan] : [request.doll.name, request.doll.mattelSku, request.doll.upcEan]
      .filter((term): term is string => Boolean(term?.trim()))
      .slice(0, 4);
    const candidates = [];
    const seen = new Set<string>();
    for (const term of terms) {
      progress('searching', region);
      const found = parseAmazonSearchResults(await driver.search(region, term), region);
      for (const candidate of found) {
        if (request.catalogRules && !request.catalogRules.requiredTerms.some((term) => candidate.title.toLowerCase().includes(term.toLowerCase()))) continue;
        if (!seen.has(candidate.asin) && candidates.length < 5) {
          candidates.push(candidate);
          seen.add(candidate.asin);
        }
      }
      if (candidates.length >= 5) break;
    }

    for (const candidate of candidates) {
      progress('checking', region);
      const html = await driver.openProduct(region, candidate.canonicalUrl);
      const page = parseAmazonProductPage(html, { region, expectedAsin: candidate.asin });
      if (page.status !== 'verified') continue;
      const match = request.catalogRules
        ? matchCatalogOffer(request.catalogRules, { title: page.title, evidenceText: `${page.title ?? ''} ${html}`, condition: page.condition })
        : matchAmazonProduct(request.doll, candidate);
      if (match.status !== 'verified') continue;
      result.regions[region] = { ...page, region, url: candidate.canonicalUrl, reviewCandidates: [], matchDiagnostic: match };
      accepted = true;
      break;
    }
    if (accepted) continue;
    result.regions[region] = {
      status: 'no_price',
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
      reviewCandidates: [],
    };
  }

  progress('completed');
  return result;
}
