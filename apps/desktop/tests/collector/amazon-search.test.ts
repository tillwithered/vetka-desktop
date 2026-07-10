import { describe, expect, it } from 'vitest';

import { parseAmazonSearchResults } from '@/collector/amazon/search';

describe('parseAmazonSearchResults', () => {
  it('returns candidates but does not mark them verified', () => {
    const html = `
      <div data-asin="B0CXYZ1234">
        <h2><a href="/Monster-High/dp/B0CXYZ1234?ref=sr_1"><span>Monster High Draculaura</span></a></h2>
        <span class="a-price"><span class="a-offscreen">$24.99</span></span>
        <img class="s-image" src="https://images.example/doll.jpg" />
      </div>`;

    expect(parseAmazonSearchResults(html, 'amazon_us')).toEqual([
      {
        asin: 'B0CXYZ1234',
        region: 'amazon_us',
        title: 'Monster High Draculaura',
        canonicalUrl: 'https://www.amazon.com/dp/B0CXYZ1234',
        visiblePrice: { minor: 2499, currency: 'USD' },
        imageUrl: 'https://images.example/doll.jpg',
        status: 'candidate',
      },
    ]);
  });
});
