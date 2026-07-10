import { describe, expect, it, vi } from 'vitest';

import { collectDoll, type CollectorDriver } from '@/collector/amazon/collect';

describe('collectDoll', () => {
  it('checks a known listing before search and accepts the verified Buy Box', async () => {
    const html = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High Draculaura</span><div id="corePrice_feature_div"><span class="a-offscreen">$24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const driver: CollectorDriver = {
      openProduct: vi.fn(async () => html),
      search: vi.fn(async () => ''),
    };
    const progress = vi.fn();

    const result = await collectDoll({
      type: 'refresh-doll', requestId: 'request-1', dataDir: 'C:/data',
      doll: { id: 'doll-1', name: 'Monster High Draculaura' },
      knownListings: [{ region: 'amazon_us', asin: 'B0CXYZ1234', url: 'https://www.amazon.com/dp/B0CXYZ1234', confirmed: true }],
      regions: ['amazon_us'],
    }, driver, progress);

    expect(result.regions.amazon_us).toMatchObject({ status: 'verified', asin: 'B0CXYZ1234', regularPrice: { minor: 2499 } });
    expect(driver.search).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledWith('checking', 'amazon_us');
  });

  it('opens a search result and persists only a strict catalog match', async () => {
    const product = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High Willow Thorne Moonspell Magic Doll JMB92</span><div id="corePrice_feature_div"><span class="a-offscreen">$24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const search = '<div data-asin="B0CXYZ1234"><h2><span>Monster High Willow Thorne Moonspell Magic Doll</span></h2><a href="/dp/B0CXYZ1234"></a></div>';
    const driver: CollectorDriver = { openProduct: vi.fn(async () => product), search: vi.fn(async () => search) };

    const result = await collectDoll({
      type: 'refresh-doll', requestId: 'request-2', dataDir: 'C:/data',
      doll: { id: 'doll-1', name: 'Willow Thorne', mattelSku: 'JMB92' }, knownListings: [], regions: ['amazon_us'],
      catalogRules: { mattelSku: 'JMB92', requiredTerms: ['Willow Thorne'], rejectTerms: ['outfit'] },
    }, driver, vi.fn());

    expect(result.regions.amazon_us).toMatchObject({ status: 'verified', asin: 'B0CXYZ1234' });
    expect(result.regions.amazon_us?.reviewCandidates).toEqual([]);
  });
});
