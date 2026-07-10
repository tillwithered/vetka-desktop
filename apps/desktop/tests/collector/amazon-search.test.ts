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

  it('uses the accessible heading on current Amazon result cards', () => {
    const html = `
      <div data-component-type="s-search-result" data-asin="B0FK856NFW">
        <h2 aria-label="Monster High Skullector Collectible Doll">
          <a href="/Monster-High/dp/B0FK856NFW?ref=sr_1"><span>Monster High</span></a>
        </h2>
        <span class="a-price"><span class="a-offscreen">KZT 34,556.00</span></span>
      </div>`;

    expect(parseAmazonSearchResults(html, 'amazon_us')).toMatchObject([
      {
        asin: 'B0FK856NFW',
        title: 'Monster High Skullector Collectible Doll',
        canonicalUrl: 'https://www.amazon.com/dp/B0FK856NFW',
        visiblePrice: { minor: 3455600, currency: 'KZT' },
      },
    ]);
  });

  it('prefers a specific visible title when Amazon initially exposes a generic accessible label', () => {
    const html = `
      <div data-component-type="s-search-result" data-asin="B0FK856NFW">
        <h2 aria-label="Monster High">
          <a href="/Monster-High/dp/B0FK856NFW?ref=sr_1"><span>Monster High Draculaura Boo-riginal Creeproduction Doll HGC29</span></a>
        </h2>
      </div>`;

    expect(parseAmazonSearchResults(html, 'amazon_us')).toMatchObject([
      { asin: 'B0FK856NFW', title: 'Monster High Draculaura Boo-riginal Creeproduction Doll HGC29' },
    ]);
  });
});
