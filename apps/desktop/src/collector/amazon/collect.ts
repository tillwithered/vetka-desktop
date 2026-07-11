import type { AmazonRegion } from '@/shared/contracts';

import type { CollectorDollResult, CollectorRequest, CollectorStage } from '../contracts';
import { matchAmazonProduct, matchCatalogOffer } from './matching';
import { isAmazonCollectorBlocked, parseAmazonProductPage, shouldRetryWithProxy, type AmazonPageResult } from './product-page';
import { amazonRegions } from './regions';
import { parseAmazonSearchResults } from './search';

export type CollectorDriver = {
  openProduct(region: AmazonRegion, url: string): Promise<string>;
  openProductViaProxy?(region: AmazonRegion, url: string): Promise<string>;
  hasProxyRoute?(region: AmazonRegion): boolean;
  search(region: AmazonRegion, term: string): Promise<string>;
};

function hasDollSearchContext(title: string): boolean {
  return /monster\s+high|mattel|fashion\s+doll|\bdoll\b/i.test(title);
}

async function readProductPage(
  driver: CollectorDriver,
  region: AmazonRegion,
  url: string,
  expectedAsin: string,
): Promise<{ html: string; page: AmazonPageResult }> {
  let html = await driver.openProduct(region, url);
  let page = parseAmazonProductPage(html, { region, expectedAsin });
  if (shouldRetryWithProxy(page.status) && driver.hasProxyRoute?.(region) && driver.openProductViaProxy) {
    html = await driver.openProductViaProxy(region, url);
    page = parseAmazonProductPage(html, { region, expectedAsin });
  }
  return { html, page };
}

export async function collectDoll(
  request: CollectorRequest,
  driver: CollectorDriver,
  progress: (stage: CollectorStage, region?: AmazonRegion) => void,
): Promise<CollectorDollResult> {
  const result: CollectorDollResult = { requestId: request.requestId, regions: {} };

  for (const region of request.regions) {
    const listings = [...request.knownListings]
      .filter((listing) => listing.confirmed)
      .sort((left, right) => Number(right.region === region) - Number(left.region === region))
      .filter((listing, index, all) => all.findIndex((candidate) => candidate.asin === listing.asin) === index);
    let accepted = false;

    for (const listing of listings) {
      progress('checking', region);
      const url = listing.region === region ? listing.url : `https://${amazonRegions[region].host}/dp/${listing.asin}`;
      const { html, page } = await readProductPage(driver, region, url, listing.asin);
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
      result.regions[region] = { ...page, region, url, reviewCandidates: [], ...(matchDiagnostic ? { matchDiagnostic } : {}) };
      if (page.status === 'verified' || page.status === 'captcha_required' || page.status === 'blocked') {
        if (page.status === 'captcha_required') progress('captcha_required', region);
        accepted = true;
        break;
      }
    }
    if (accepted) continue;

    if (request.knownAsinsOnly) {
      result.regions[region] = {
        status: 'no_price', asin: null, title: null, regularPrice: null, primePrice: null, subscriptionPrice: null,
        couponText: null, seller: null, fulfilledByAmazon: false, availability: null, condition: null,
        region, url: null, reviewCandidates: [],
      };
      continue;
    }

    const catalogTerms = request.catalogRules
      ? (request.catalogRules.searchQuery
        ? [request.catalogRules.searchQuery, request.catalogRules.mattelSku, request.catalogRules.requiredTerms.join(' '), request.doll.name, request.catalogRules.upcEan]
        : [request.catalogRules.requiredTerms.join(' '), request.doll.name, request.catalogRules.mattelSku, request.catalogRules.upcEan])
      : null;
    const terms = (catalogTerms
      ? catalogTerms
      : [request.doll.name, request.doll.mattelSku, request.doll.upcEan])
      .filter((term): term is string => Boolean(term?.trim()))
      .filter((term, index, all) => all.indexOf(term) === index)
      .slice(0, 5);
    const candidates = [];
    const seen = new Set<string>();
    for (const term of terms) {
      progress('searching', region);
      const searchHtml = await driver.search(region, term);
      if (isAmazonCollectorBlocked(searchHtml)) {
        result.regions[region] = {
          status: 'blocked', asin: null, title: null, regularPrice: null, primePrice: null, subscriptionPrice: null,
          couponText: null, seller: null, fulfilledByAmazon: false, availability: null, condition: null,
          region, url: null, reviewCandidates: [],
        };
        accepted = true;
        break;
      }
      const found = parseAmazonSearchResults(searchHtml, region);
      for (const candidate of found) {
        if (request.catalogRules
          && !request.catalogRules.requiredTerms.some((term) => candidate.title.toLowerCase().includes(term.toLowerCase()))
          && !hasDollSearchContext(candidate.title)) continue;
        if (!seen.has(candidate.asin) && candidates.length < 12) {
          candidates.push(candidate);
          seen.add(candidate.asin);
        }
      }
      if (candidates.length >= 12) break;
    }

    for (const candidate of candidates) {
      progress('checking', region);
      const { html, page } = await readProductPage(driver, region, candidate.canonicalUrl, candidate.asin);
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
