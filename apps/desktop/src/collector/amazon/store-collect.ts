import type { AmazonRegion } from '@/shared/contracts';
import type { CollectorOfficialStoreResult } from '../contracts';

import { isAmazonCaptcha, isAmazonCollectorBlocked } from './product-page';
import { officialMonsterHighStoreUrls, parseAmazonStoreCards, parseAmazonStoreLinks, parseOfficialStoreDoll } from './store';
import { safeStoreError } from './store-error';

export type OfficialStoreDriver = {
  openStore(region: AmazonRegion, url: string): Promise<string>;
  openStoreViaProxy?(region: AmazonRegion, url: string): Promise<string>;
  openStoreProduct(region: AmazonRegion, url: string): Promise<string>;
  openStoreProductViaProxy?(region: AmazonRegion, url: string): Promise<string>;
  hasProxyRoute?(region: AmazonRegion): boolean;
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

function isBlocked(html: string): boolean {
  return isAmazonCollectorBlocked(html) || isAmazonCaptcha(html);
}

async function readStorePage(
  driver: OfficialStoreDriver,
  region: AmazonRegion,
  url: string,
  kind: 'store' | 'product',
): Promise<string> {
  const direct = kind === 'store' ? driver.openStore : driver.openStoreProduct;
  const fallback = kind === 'store' ? driver.openStoreViaProxy : driver.openStoreProductViaProxy;
  let html = await direct(region, url);
  if (isBlocked(html) && driver.hasProxyRoute?.(region) && fallback) {
    html = await fallback(region, url);
  }
  return html;
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
      const storeHtml = await readStorePage(input.driver, region, officialMonsterHighStoreUrls[region], 'store');
      if (isBlocked(storeHtml)) {
        result.regions[region] = { status: 'blocked', total: 0, error: blockedError(storeHtml) };
        continue;
      }

      const links = parseAmazonStoreLinks(storeHtml, region);
      if (links.length === 0) {
        result.regions[region] = { status: 'failed', total: 0, error: 'Store page did not contain product links' };
        continue;
      }
      const cards = parseAmazonStoreCards(storeHtml, region);
      const cardAsins = new Set(cards.map((card) => card.asin));
      const regionProducts = [...cards];
      input.onProgress?.({ stage: 'checking', region, processed: cards.length, total: links.length });

      let blockedProductHtml: string | null = null;
      for (const [index, link] of links.filter((candidate) => !cardAsins.has(candidate.asin)).entries()) {
        const processed = cards.length + index + 1;
        input.onProgress?.({ stage: 'checking', region, processed, total: links.length });
        const html = await readStorePage(input.driver, region, link.url, 'product');
        if (isBlocked(html)) {
          blockedProductHtml = html;
          break;
        }
        const doll = parseOfficialStoreDoll(html, region, link.url);
        if (doll) regionProducts.push(doll);
      }
      if (blockedProductHtml) {
        result.regions[region] = { status: 'blocked', total: links.length, error: blockedError(blockedProductHtml) };
        continue;
      }

      result.products.push(...regionProducts);
      result.regions[region] = { status: 'completed', total: links.length };
      input.onProgress?.({ stage: 'completed', region, processed: links.length, total: links.length });
    } catch (error) {
      result.regions[region] = { status: 'failed', total: 0, error: safeStoreError(error) };
    }
  }

  return result;
}
