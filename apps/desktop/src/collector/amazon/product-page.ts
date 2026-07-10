import { load } from 'cheerio';

import type { AmazonRegion } from '@/shared/contracts';

import { parseLocalizedMoney, parseStructuredMoney, type ParsedMoney } from './money';
import { amazonRegions } from './regions';

export type AmazonPageStatus =
  | 'verified'
  | 'out_of_stock'
  | 'no_price'
  | 'captcha_required'
  | 'parser_changed'
  | 'identity_mismatch'
  | 'conflict';

export type AmazonPageResult = {
  status: AmazonPageStatus;
  asin: string | null;
  title: string | null;
  regularPrice: ParsedMoney | null;
  primePrice: ParsedMoney | null;
  subscriptionPrice: ParsedMoney | null;
  couponText: string | null;
  seller: string | null;
  fulfilledByAmazon: boolean;
  availability: 'in_stock' | 'preorder' | 'out_of_stock' | null;
  condition: 'New' | null;
};

const emptyResult = (status: AmazonPageStatus): AmazonPageResult => ({
  status,
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
});

function firstText($: ReturnType<typeof load>, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = $(selector).first().text().replace(/\s+/g, ' ').trim();
    if (value) return value;
  }
  return null;
}

function structuredPrices($: ReturnType<typeof load>, currency: 'USD' | 'GBP' | 'EUR'): ParsedMoney[] {
  const prices: ParsedMoney[] = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      const value = JSON.parse($(element).text()) as unknown;
      const queue: unknown[] = [value];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;
        if (Array.isArray(current)) {
          queue.push(...current);
          continue;
        }
        const record = current as Record<string, unknown>;
        const parsed = parseStructuredMoney(record.price, currency);
        if (parsed) prices.push(parsed);
        queue.push(...Object.values(record).filter((entry) => typeof entry === 'object'));
      }
    } catch {
      // Invalid structured data is ignored; the recognized visible Buy Box remains authoritative.
    }
  });
  return prices;
}

export function parseAmazonProductPage(
  html: string,
  context: { region: AmazonRegion; expectedAsin: string },
): AmazonPageResult {
  if (/validateCaptcha|enter the characters you see below|robot check/i.test(html)) {
    return emptyResult('captcha_required');
  }

  const $ = load(html);
  const asin = String($('#ASIN').attr('value') ?? $('[data-asin]').first().attr('data-asin') ?? '').toUpperCase() || null;
  const title = firstText($, ['#productTitle', 'h1.a-size-large']);
  const base = emptyResult('no_price');
  base.asin = asin;
  base.title = title;
  if (!asin || asin !== context.expectedAsin.toUpperCase()) return { ...base, status: 'identity_mismatch' };

  const config = amazonRegions[context.region];
  const availabilityText = firstText($, ['#availability', '#outOfStock']) ?? '';
  const outOfStock = /currently unavailable|temporarily out of stock|nicht verfügbar|no disponible|non disponibile|agotado/i.test(availabilityText);
  if (outOfStock) return { ...base, status: 'out_of_stock', availability: 'out_of_stock' };

  const regularText = firstText($, [
    '#corePrice_feature_div .a-offscreen',
    '#apex_desktop .a-offscreen',
    '#priceblock_ourprice',
    '#price_inside_buybox',
  ]);
  const primeText = firstText($, ['[data-vetka-offer="prime"] .a-offscreen']);
  const subscriptionText = firstText($, ['[data-vetka-offer="subscription"] .a-offscreen', '#sns-base-price']);
  const regularPrice = regularText ? parseLocalizedMoney(regularText, config.currency) : null;
  const primePrice = primeText ? parseLocalizedMoney(primeText, config.currency) : null;
  const subscriptionPrice = subscriptionText ? parseLocalizedMoney(subscriptionText, config.currency) : null;
  const structured = structuredPrices($, config.currency);

  if (regularPrice && structured.some((price) => Math.abs(price.minor - regularPrice.minor) > 1)) {
    return { ...base, status: 'conflict' };
  }
  if (!regularPrice && !primePrice && !subscriptionPrice) {
    return { ...base, status: title && /in stock|auf lager|en stock|disponibilit/i.test(availabilityText) ? 'parser_changed' : 'no_price' };
  }

  const seller = firstText($, ['#merchant-info a', '#sellerProfileTriggerId', '#merchant-info']);
  const merchantText = firstText($, ['#merchant-info']) ?? '';
  const conditionText = firstText($, ['#condition', '#newAccordionRow']) ?? '';
  const condition = /new|neu|nuevo|nuovo/i.test(conditionText) ? 'New' : null;
  if (conditionText && !condition) return { ...base, status: 'identity_mismatch' };

  return {
    status: 'verified',
    asin,
    title,
    regularPrice,
    primePrice,
    subscriptionPrice,
    couponText: firstText($, ['#couponText', '.couponLabelText']),
    seller,
    fulfilledByAmazon: /amazon\.(com|co\.uk|de|es|it)/i.test(merchantText),
    availability: /pre-?order|vorbestell|reserva|preordin/i.test(availabilityText) ? 'preorder' : 'in_stock',
    condition: condition ?? 'New',
  };
}
