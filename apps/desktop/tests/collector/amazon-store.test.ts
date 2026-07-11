import { describe, expect, it } from 'vitest';

import { parseAmazonStoreCards, parseAmazonStoreLinks, parseOfficialStoreDoll } from '@/collector/amazon/store';

describe('official Monster High Store parsing', () => {
  it('extracts unique canonical product links from a regional Store page', () => {
    const html = '<a href="/Monster-High-Robecca/dp/B0FK1V67X5?ref_=ast_sto_dp">Robecca</a><a href="/dp/B0FK1V67X5">Duplicate</a><a href="/stores/MonsterHigh/page/abc">Store</a>';

    expect(parseAmazonStoreLinks(html, 'amazon_uk')).toEqual([
      { region: 'amazon_uk', asin: 'B0FK1V67X5', url: 'https://www.amazon.co.uk/dp/B0FK1V67X5' },
    ]);
  });

  it('uses a price already rendered in an official Store card without opening its product page', () => {
    const html = `
      <article data-asin="B0FK1V67X5">
        <a href="/Monster-High-Robecca/dp/B0FK1V67X5?ref_=ast_sto_dp" aria-label="Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59">
          <img src="https://images.example/robecca.jpg" alt="Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59">
        </a>
        <h2>Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</h2>
        <span class="a-offscreen">£24.99</span>
      </article>`;

    expect(parseAmazonStoreCards(html, 'amazon_uk')).toEqual([{
      region: 'amazon_uk',
      asin: 'B0FK1V67X5',
      url: 'https://www.amazon.co.uk/dp/B0FK1V67X5',
      name: 'Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59',
      mattelSku: 'JHK59',
      imageUrl: 'https://images.example/robecca.jpg',
      price: { minor: 2499, currency: 'GBP' },
      seller: null,
      fulfilledByAmazon: false,
      availability: 'unknown',
    }]);
  });

  it('finds a Store card when Amazon wraps it in generic divs', () => {
    const html = `
      <div class="store-card">
        <a href="/Monster-High-Robecca/dp/B0FK1V67X5"><img src="https://images.example/robecca.jpg" alt="Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59"></a>
        <a href="/Monster-High-Robecca/dp/B0FK1V67X5">Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</a>
        <div class="title">Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</div>
        <span class="a-offscreen">GBP 24.99</span>
      </div>`;

    expect(parseAmazonStoreCards(html, 'amazon_uk')).toMatchObject([{
      asin: 'B0FK1V67X5', mattelSku: 'JHK59', price: { minor: 2499, currency: 'GBP' },
    }]);
  });

  it('accepts a New Monster High doll with a Mattel SKU and rejects Store accessories', () => {
    const doll = '<input id="ASIN" value="B0FK1V67X5"><span id="productTitle">Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</span><img id="landingImage" src="https://images.example/robecca.jpg"><div id="corePrice_feature_div"><span class="a-offscreen">£24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const accessory = '<input id="ASIN" value="B0FDH2BVXH"><span id="productTitle">Monster High Doll Accessories Earphones JHK31</span><div id="corePrice_feature_div"><span class="a-offscreen">£4.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';

    expect(parseOfficialStoreDoll(doll, 'amazon_uk', 'https://www.amazon.co.uk/dp/B0FK1V67X5')).toMatchObject({
      mattelSku: 'JHK59', name: expect.stringContaining('Robecca'), imageUrl: 'https://images.example/robecca.jpg', price: { minor: 2499, currency: 'GBP' },
    });
    expect(parseOfficialStoreDoll(accessory, 'amazon_uk', 'https://www.amazon.co.uk/dp/B0FDH2BVXH')).toBeNull();
  });

  it('uses the model number when a Store product title does not contain the SKU', () => {
    const doll = '<input id="ASIN" value="B0FK1V67X5"><span id="productTitle">Monster High Robecca Steam Boo-riginal Creeproduction Doll</span><div id="corePrice_feature_div"><span class="a-offscreen">GBP 24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div><table id="productDetails_detailBullets_sections1"><tr><th>Item model number</th><td>JHK59</td></tr></table>';

    expect(parseOfficialStoreDoll(doll, 'amazon_uk', 'https://www.amazon.co.uk/dp/B0FK1V67X5')).toMatchObject({
      mattelSku: 'JHK59', price: { minor: 2499, currency: 'GBP' },
    });
  });

  it('recognizes the Spanish doll label rendered by the ES Store', () => {
    const html = `
      <article data-asin="B0FSPANISH">
        <a href="/Monster-High-Lagoona/dp/B0FSPANISH"><img alt="Monster High Lagoona Blue Muñeca JHK33" src="https://images.example/lagoona.jpg"></a>
        <h2>Monster High Lagoona Blue Muñeca JHK33</h2>
        <span class="a-offscreen">23,71 €</span>
      </article>`;

    expect(parseAmazonStoreCards(html, 'amazon_es')).toMatchObject([{
      asin: 'B0FSPANISH', mattelSku: 'JHK33', price: { minor: 2371, currency: 'EUR' },
    }]);
  });
});
