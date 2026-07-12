import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAmazonProductPage, shouldRetryWithProxy } from '@/collector/amazon/product-page';
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

  it('rejects a KZT delivered price instead of treating it as an Amazon US price', () => {
    const html = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High Draculaura</span><div id="corePrice_feature_div"><span class="a-offscreen">KZT 66,276.71</span></div><div id="availability">Only 14 left in stock</div><div id="condition">New</div>';

    expect(parseAmazonProductPage(html, { region: 'amazon_us', expectedAsin: 'B0CXYZ1234' })).toMatchObject({
      status: 'parser_changed',
      regularPrice: null,
    });
  });

  it('rejects a foreign-currency price shown on a marketplace product page', () => {
    const html = '<input id="ASIN" value="B0FK1V67X5"><span id="productTitle">Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</span><div id="corePrice_feature_div"><span class="a-offscreen">28,11 GBP</span></div><div id="availability">Auf Lager</div><div id="condition">Neu</div>';

    expect(parseAmazonProductPage(html, { region: 'amazon_de', expectedAsin: 'B0FK1V67X5' })).toMatchObject({
      status: 'parser_changed',
      regularPrice: null,
    });
  });

  it('rejects a concatenated KZT delivered price instead of treating it as USD', () => {
    const html = '<input id="ASIN" value="B0FK18MKKJ"><span id="productTitle">Monster High Venus McFlytrap Boo-riginal Creeproduction Doll JHK58</span><div id="corePrice_feature_div"><span class="a-offscreen">KZT17,039.37</span></div><div id="availability">In Stock</div><div id="condition">New</div>';

    expect(parseAmazonProductPage(html, { region: 'amazon_us', expectedAsin: 'B0FK18MKKJ' })).toMatchObject({
      status: 'parser_changed',
      regularPrice: null,
    });
  });

  it('reads the current Amazon accessible price when the legacy offscreen span is blank', () => {
    const html = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High Catty Noir Doll HXH76</span><div id="corePrice_feature_div"><span class="a-offscreen"></span><span class="apex-pricetopay-accessibility-label">€34.99</span></div><div id="availability">In stock</div><div id="condition">New</div>';

    expect(parseAmazonProductPage(html, { region: 'amazon_es', expectedAsin: 'B0CXYZ1234' })).toMatchObject({
      status: 'verified',
      regularPrice: { minor: 3499, currency: 'EUR' },
    });
  });

  it('keeps an Amazon thumbnail alongside a verified product', () => {
    const html = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High Draculaura</span><img id="landingImage" src="https://images.example/doll.jpg"><div id="corePrice_feature_div"><span class="a-offscreen">$24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    expect(parseAmazonProductPage(html, { region: 'amazon_us', expectedAsin: 'B0CXYZ1234' })).toMatchObject({ status: 'verified', imageUrl: 'https://images.example/doll.jpg' });
  });

  it('extracts a Mattel model number from Amazon product details', () => {
    const html = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High Robecca Steam Boo-riginal Creeproduction Doll</span><div id="corePrice_feature_div"><span class="a-offscreen">GBP 24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div><table id="productDetails_detailBullets_sections1"><tr><th>Item model number</th><td>JHK59</td></tr></table>';

    expect(parseAmazonProductPage(html, { region: 'amazon_uk', expectedAsin: 'B0CXYZ1234' })).toMatchObject({
      status: 'verified',
      modelNumber: 'JHK59',
    });
  });

  it('rejects a different product identity', () => {
    expect(parseAmazonProductPage(fixture('amazon_us'), { region: 'amazon_us' as AmazonRegion, expectedAsin: 'B000000000' }).status).toBe('identity_mismatch');
  });
});

describe('shouldRetryWithProxy', () => {
  it.each(['blocked', 'captcha_required'] as const)('retries %s through the regional proxy', (status) => {
    expect(shouldRetryWithProxy(status)).toBe(true);
  });

  it.each(['no_price', 'out_of_stock', 'identity_mismatch', 'conflict', 'parser_changed'] as const)('does not spend proxy bandwidth for %s', (status) => {
    expect(shouldRetryWithProxy(status)).toBe(false);
  });
});
