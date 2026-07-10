import { describe, expect, it } from 'vitest';

import { parseAmazonStoreLinks, parseOfficialStoreDoll } from '@/collector/amazon/store';

describe('official Monster High Store parsing', () => {
  it('extracts unique canonical product links from a regional Store page', () => {
    const html = '<a href="/Monster-High-Robecca/dp/B0FK1V67X5?ref_=ast_sto_dp">Robecca</a><a href="/dp/B0FK1V67X5">Duplicate</a><a href="/stores/MonsterHigh/page/abc">Store</a>';

    expect(parseAmazonStoreLinks(html, 'amazon_uk')).toEqual([
      { region: 'amazon_uk', asin: 'B0FK1V67X5', url: 'https://www.amazon.co.uk/dp/B0FK1V67X5' },
    ]);
  });

  it('accepts a New Monster High doll with a Mattel SKU and rejects Store accessories', () => {
    const doll = '<input id="ASIN" value="B0FK1V67X5"><span id="productTitle">Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</span><img id="landingImage" src="https://images.example/robecca.jpg"><div id="corePrice_feature_div"><span class="a-offscreen">£24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const accessory = '<input id="ASIN" value="B0FDH2BVXH"><span id="productTitle">Monster High Doll Accessories Earphones JHK31</span><div id="corePrice_feature_div"><span class="a-offscreen">£4.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';

    expect(parseOfficialStoreDoll(doll, 'amazon_uk', 'https://www.amazon.co.uk/dp/B0FK1V67X5')).toMatchObject({
      mattelSku: 'JHK59', name: expect.stringContaining('Robecca'), imageUrl: 'https://images.example/robecca.jpg', price: { minor: 2499, currency: 'GBP' },
    });
    expect(parseOfficialStoreDoll(accessory, 'amazon_uk', 'https://www.amazon.co.uk/dp/B0FDH2BVXH')).toBeNull();
  });
});
