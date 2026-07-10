import { describe, expect, it } from 'vitest';

import { normalizeAmazonUrl } from '@/collector/amazon/url';

describe('normalizeAmazonUrl', () => {
  it.each([
    ['https://www.amazon.com/dp/B0CXYZ1234?tag=affiliate', 'amazon_us', 'B0CXYZ1234'],
    ['https://amazon.co.uk/gp/product/b0cxyz1234/ref=something', 'amazon_uk', 'B0CXYZ1234'],
    ['https://www.amazon.de/dp/B0CXYZ1234', 'amazon_de', 'B0CXYZ1234'],
    ['https://amazon.es/gp/product/B0CXYZ1234', 'amazon_es', 'B0CXYZ1234'],
    ['https://www.amazon.it/dp/B0CXYZ1234', 'amazon_it', 'B0CXYZ1234'],
  ])('normalizes %s', (url, region, asin) => {
    expect(normalizeAmazonUrl(url)).toEqual({
      region,
      asin,
      canonicalUrl: expect.stringContaining(`/dp/${asin}`),
    });
  });

  it.each([
    'https://example.com/dp/B0CXYZ1234',
    'https://www.amazon.com/s?k=B0CXYZ1234',
    'https://www.amazon.com/dp/TOO-SHORT',
  ])('rejects unsupported or malformed URL %s', (url) => {
    expect(() => normalizeAmazonUrl(url)).toThrow();
  });
});
