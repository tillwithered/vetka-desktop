import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAmazonProductPage } from '@/collector/amazon/product-page';
import type { AmazonRegion } from '@/shared/contracts';

const fixture = (name: string) => readFileSync(path.join(__dirname, '..', 'fixtures', 'amazon', `${name}.html`), 'utf8');

describe('parseAmazonProductPage', () => {
  it.each([
    ['amazon_us', 2499, 'USD', 'Amazon.com'],
    ['amazon_uk', 2999, 'GBP', 'Amazon.co.uk'],
    ['amazon_de', 3120, 'EUR', 'Amazon.de'],
    ['amazon_es', 3190, 'EUR', 'Amazon.es'],
    ['amazon_it', 3099, 'EUR', 'Amazon.it'],
  ] as const)('extracts a trustworthy %s Buy Box', (region, minor, currency, seller) => {
    expect(parseAmazonProductPage(fixture(region), { region, expectedAsin: 'B0CXYZ1234' })).toMatchObject({
      status: 'verified',
      asin: 'B0CXYZ1234',
      regularPrice: { minor, currency },
      seller,
      condition: 'New',
      availability: 'in_stock',
    });
  });

  it.each([
    ['captcha', 'captcha_required'],
    ['out-of-stock', 'out_of_stock'],
    ['conflict', 'conflict'],
    ['changed-markup', 'parser_changed'],
  ])('returns %s without inventing a price', (name, status) => {
    const result = parseAmazonProductPage(fixture(name), { region: 'amazon_us', expectedAsin: 'B0CXYZ1234' });
    expect(result.status).toBe(status);
    expect(result.regularPrice).toBeNull();
  });

  it('keeps Prime and coupon information separate', () => {
    expect(parseAmazonProductPage(fixture('prime-only'), { region: 'amazon_us', expectedAsin: 'B0CXYZ1234' })).toMatchObject({
      status: 'verified',
      regularPrice: null,
      primePrice: { minor: 2399, currency: 'USD' },
      couponText: 'Save 10% with coupon',
    });
  });

  it('rejects a different product identity', () => {
    expect(parseAmazonProductPage(fixture('amazon_us'), { region: 'amazon_us' as AmazonRegion, expectedAsin: 'B000000000' }).status).toBe('identity_mismatch');
  });
});
