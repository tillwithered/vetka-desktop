import { load } from 'cheerio';

import type { AmazonRegion } from '@/shared/contracts';

import { parseLocalizedMoney, parseStructuredMoney, type ParsedMoney } from './money';
import { amazonRegions, type AmazonCurrency } from './regions';

export type AmazonPageStatus =
  | 'verified'
  | 'out_of_stock'
  | 'no_price'
  | 'blocked'
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
  imageUrl?: string | null;
  modelNumber?: string | null;
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
  imageUrl: null,
  modelNumber: null,
});

export function isAmazonCollectorBlocked(html: string): boolean {
  return /data-vetka-collector-status\s*=\s*["']blocked["']/i.test(html);
}

export function isAmazonCaptcha(html: string): boolean {
  return /validateCaptcha|enter the characters you see below|robot check/i.test(html);
}

function firstText($: ReturnType<typeof load>, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = $(selector).first().text().replace(/\s+/g, ' ').trim();
    if (value) return value;
  }
  return null;
}

function productDetail($: ReturnType<typeof load>, labels: RegExp[]): string | null {
  for (const row of $('tr').toArray()) {
    const label = $(row).find('th').first().text().replace(/\s+/g, ' ').trim();
    if (labels.some((pattern) => pattern.test(label))) {
      const value = $(row).find('td').first().text().replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }
  for (const item of $('#detailBullets_feature_div li, #productDetails_detailBullets_sections1 li').toArray()) {
    const text = $(item).text().replace(/\s+/g, ' ').trim();
    if (!labels.some((pattern) => pattern.test(text))) continue;
    const value = text.replace(/^.*?(?:item model number|model number|manufacturer part number)\s*[:：]?\s*/i, '').trim();
    if (value) return value;
  }
  return null;
}

function mattelSku(value: string | null): string | null {
  return value?.match(/\b[A-Z]{2,4}\d{2,4}\b/i)?.[0]?.toUpperCase() ?? null;
}

function structuredPrices($: ReturnType<typeof load>, currency: AmazonCurrency): ParsedMoney[] {
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
  if (isAmazonCollectorBlocked(html)) return emptyResult('blocked');
  if (isAmazonCaptcha(html)) {
    return emptyResult('captcha_required');
  }

  const $ = load(html);
  const asin = String($('#ASIN').attr('value') ?? $('[data-asin]').first().attr('data-asin') ?? '').toUpperCase() || null;
  const title = firstText($, ['#productTitle', 'h1.a-size-large']);
  const base = emptyResult('no_price');
  base.asin = asin;
  base.title = title;
  base.imageUrl = $('#landingImage').attr('src') ?? $('#imgTagWrapperId img').first().attr('src') ?? null;
  base.modelNumber = mattelSku(productDetail($, [/item model number/i, /^model number$/i, /manufacturer part number/i]));
  if (!asin || asin !== context.expectedAsin.toUpperCase()) return { ...base, status: 'identity_mismatch' };

  const config = amazonRegions[context.region];
  const availabilityText = firstText($, ['#availability', '#outOfStock']) ?? '';
  const outOfStock = /currently unavailable|temporarily out of stock|nicht verfügbar|no disponible|non disponibile|agotado/i.test(availabilityText);
  if (outOfStock) return { ...base, status: 'out_of_stock', availability: 'out_of_stock' };

  const regularText = firstText($, [
    '#corePrice_feature_div .a-offscreen',
    '#corePrice_feature_div .apex-pricetopay-accessibility-label',
    '#apex-pricetopay-accessibility-label',
    '#apex_desktop .a-offscreen',
    '#priceblock_ourprice',
    '#price_inside_buybox',
  ]);
  const primeText = firstText($, ['[data-vetka-offer="prime"] .a-offscreen']);
  const subscriptionText = firstText($, ['[data-vetka-offer="subscription"] .a-offscreen', '#sns-base-price']);
  const currencyFor = (text: string | null): AmazonCurrency => /\bKZT\b/i.test(text ?? '') ? 'KZT' : config.currency;
  const regularCurrency = currencyFor(regularText);
  const regularPrice = regularText ? parseLocalizedMoney(regularText, regularCurrency) : null;
  const primePrice = primeText ? parseLocalizedMoney(primeText, currencyFor(primeText)) : null;
  const subscriptionPrice = subscriptionText ? parseLocalizedMoney(subscriptionText, currencyFor(subscriptionText)) : null;
  const structured = regularCurrency === config.currency ? structuredPrices($, config.currency) : [];

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
    imageUrl: base.imageUrl,
    modelNumber: base.modelNumber,
  };
}
