import type { AmazonRegion } from '@/shared/contracts';
import type { CollectorOfficialStoreResult } from '../contracts';

import { isAmazonCaptcha, isAmazonCollectorBlocked } from './product-page';
import { officialMonsterHighStoreUrls, parseAmazonStoreCards, parseAmazonStoreLinks, parseOfficialStoreDoll } from './store';

export type OfficialStoreDriver = {
  openStore(region: AmazonRegion, url: string): Promise<string>;
  openStoreProduct(region: AmazonRegion, url: string): Promise<string>;
  advanceProxyRoute?(region: AmazonRegion): Promise<boolean>;
};

export type OfficialStoreProgress = (event: {
  stage: 'searching' | 'checking' | 'completed';
  region: AmazonRegion;
  processed: number;
  total: number;
}) => void;

function blockedError(html: string): string {
  return isAmazonCaptcha(html) ? 'Amazon requested CAPTCHA for Store import' : 'Amazon temporarily blocked Store import';
}

export async function collectOfficialStore(input: {
  requestId: string;
  regions: readonly AmazonRegion[];
  driver: OfficialStoreDriver;
  onProgress?: OfficialStoreProgress;
}): Promise<CollectorOfficialStoreResult> {
  const result: CollectorOfficialStoreResult = { requestId: input.requestId, products: [], regions: {} };

  for (const region of input.regions) {
    input.onProgress?.({ stage: 'searching', region, processed: 0, total: 0 });
    try {
      let retriedWithNextRoute = false;
      let completed = false;
      while (!completed) {
        const storeHtml = await input.driver.openStore(region, officialMonsterHighStoreUrls[region]);
        if (isAmazonCollectorBlocked(storeHtml) || isAmazonCaptcha(storeHtml)) {
          if (!retriedWithNextRoute && await input.driver.advanceProxyRoute?.(region)) {
            retriedWithNextRoute = true;
            continue;
          }
          result.regions[region] = { status: 'blocked', total: 0, error: blockedError(storeHtml) };
          break;
        }

        const links = parseAmazonStoreLinks(storeHtml, region);
        const cards = parseAmazonStoreCards(storeHtml, region);
        const cardAsins = new Set(cards.map((card) => card.asin));
        const regionProducts = [...cards];
        input.onProgress?.({ stage: 'checking', region, processed: cards.length, total: links.length });

        let blockedProductHtml: string | null = null;
        for (const [index, link] of links.filter((candidate) => !cardAsins.has(candidate.asin)).entries()) {
          const processed = cards.length + index + 1;
          input.onProgress?.({ stage: 'checking', region, processed, total: links.length });
          const html = await input.driver.openStoreProduct(region, link.url);
          if (isAmazonCollectorBlocked(html) || isAmazonCaptcha(html)) {
            blockedProductHtml = html;
            break;
          }
          const doll = parseOfficialStoreDoll(html, region, link.url);
          if (doll) regionProducts.push(doll);
        }
        if (blockedProductHtml) {
          if (!retriedWithNextRoute && await input.driver.advanceProxyRoute?.(region)) {
            retriedWithNextRoute = true;
            continue;
          }
          result.regions[region] = { status: 'blocked', total: links.length, error: blockedError(blockedProductHtml) };
          break;
        }

        result.products.push(...regionProducts);
        result.regions[region] = { status: 'completed', total: links.length };
        input.onProgress?.({ stage: 'completed', region, processed: links.length, total: links.length });
        completed = true;
      }
    } catch {
      result.regions[region] = { status: 'failed', total: 0, error: 'Store import failed' };
    }
  }

  return result;
}
