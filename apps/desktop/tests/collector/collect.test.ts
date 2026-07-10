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

  it('probes a confirmed ES ASIN on UK before search and verifies it by facts', async () => {
    const product = '<input id="ASIN" value="B0FK1V67X5"><span id="productTitle">Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</span><div id="corePrice_feature_div"><span class="a-offscreen">£24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const driver: CollectorDriver = { openProduct: vi.fn(async () => product), search: vi.fn(async () => '') };

    const result = await collectDoll({
      type: 'refresh-doll', requestId: 'request-cross-region', dataDir: 'C:/data',
      doll: { id: 'robecca', name: 'Robecca Steam Boo-riginal Creeproduction', mattelSku: 'JHK59' },
      knownListings: [{ region: 'amazon_es', asin: 'B0FK1V67X5', url: 'https://www.amazon.es/dp/B0FK1V67X5', confirmed: true }],
      regions: ['amazon_uk'],
      catalogRules: { mattelSku: 'JHK59', requiredTerms: ['Robecca Steam', 'Creeproduction'], rejectTerms: ['outfit'] },
    }, driver, vi.fn());

    expect(driver.openProduct).toHaveBeenCalledWith('amazon_uk', 'https://www.amazon.co.uk/dp/B0FK1V67X5');
    expect(driver.search).not.toHaveBeenCalled();
    expect(result.regions.amazon_uk).toMatchObject({ status: 'verified', asin: 'B0FK1V67X5', regularPrice: { minor: 2499, currency: 'GBP' } });
  });

  it('returns blocked when a direct regional ASIN probe receives a transient Amazon response', async () => {
    const driver: CollectorDriver = { openProduct: vi.fn(async () => '<html data-vetka-collector-status="blocked"></html>'), search: vi.fn(async () => '') };

    const result = await collectDoll({
      type: 'refresh-doll', requestId: 'request-blocked', dataDir: 'C:/data',
      doll: { id: 'robecca', name: 'Robecca Steam', mattelSku: 'JHK59' },
      knownListings: [{ region: 'amazon_es', asin: 'B0FK1V67X5', url: 'https://www.amazon.es/dp/B0FK1V67X5', confirmed: true }],
      regions: ['amazon_uk'],
      catalogRules: { mattelSku: 'JHK59', requiredTerms: ['Robecca Steam'], rejectTerms: ['outfit'] },
    }, driver, vi.fn());

    expect(result.regions.amazon_uk).toMatchObject({ status: 'blocked', asin: null });
    expect(driver.search).not.toHaveBeenCalled();
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
    expect(driver.search).toHaveBeenCalledWith('amazon_us', 'Willow Thorne');
  });

  it('does not open an unrelated SKU search result before matching its title', async () => {
    const search = '<div data-asin="B0HUNTER00"><h2><span>Hunter x Hunter Volume 29</span></h2><a href="/dp/B0HUNTER00"></a></div>';
    const driver: CollectorDriver = { openProduct: vi.fn(async () => ''), search: vi.fn(async () => search) };
    await collectDoll({ type: 'refresh-doll', requestId: 'request-4', dataDir: 'C:/data', doll: { id: 'doll-1', name: 'Draculaura Boo-riginal Creeproduction', mattelSku: 'HGC29' }, knownListings: [], regions: ['amazon_us'], catalogRules: { mattelSku: 'HGC29', requiredTerms: ['Draculaura', 'Creeproduction'], rejectTerms: ['outfit'] } }, driver, vi.fn());
    expect(driver.openProduct).not.toHaveBeenCalled();
  });

  it('opens a generic Monster High search card so the product-page facts can verify the SKU', async () => {
    const search = '<div data-asin="B0CXYZ1234"><h2 aria-label="Monster High"><span>Monster High</span></h2><a href="/dp/B0CXYZ1234"></a></div>';
    const product = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High Draculaura Boo-riginal Creeproduction Doll HGC29</span><div id="corePrice_feature_div"><span class="a-offscreen">$24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const driver: CollectorDriver = { openProduct: vi.fn(async () => product), search: vi.fn(async () => search) };

    const result = await collectDoll({ type: 'refresh-doll', requestId: 'request-5', dataDir: 'C:/data', doll: { id: 'doll-1', name: 'Draculaura', mattelSku: 'HGC29' }, knownListings: [], regions: ['amazon_us'], catalogRules: { mattelSku: 'HGC29', requiredTerms: ['Draculaura', 'Creeproduction'], rejectTerms: ['outfit'] } }, driver, vi.fn());

    expect(driver.openProduct).toHaveBeenCalledWith('amazon_us', 'https://www.amazon.com/dp/B0CXYZ1234');
    expect(result.regions.amazon_us).toMatchObject({ status: 'verified', asin: 'B0CXYZ1234' });
  });

  it('uses the catalogue search query before broad name matching', async () => {
    const product = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High Willow Thorne Moonspell Magic Doll JMB92</span><div id="corePrice_feature_div"><span class="a-offscreen">$24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const search = '<div data-asin="B0CXYZ1234"><h2><span>Monster High Willow Thorne Moonspell Magic Doll JMB92</span></h2><a href="/dp/B0CXYZ1234"></a></div>';
    const driver: CollectorDriver = { openProduct: vi.fn(async () => product), search: vi.fn(async () => search) };

    await collectDoll({ type: 'refresh-doll', requestId: 'request-6', dataDir: 'C:/data', doll: { id: 'doll-1', name: 'Willow Thorne', mattelSku: 'JMB92' }, knownListings: [], regions: ['amazon_us'], catalogRules: { mattelSku: 'JMB92', searchQuery: 'Monster High JMB92', requiredTerms: ['Willow Thorne'], rejectTerms: ['outfit'] } }, driver, vi.fn());

    expect(driver.search).toHaveBeenCalledWith('amazon_us', 'Monster High JMB92');
  });

  it('does not trust a known listing when it no longer passes catalog identity', async () => {
    const product = '<input id="ASIN" value="B0CXYZ1234"><span id="productTitle">Monster High unrelated doll</span><div id="corePrice_feature_div"><span class="a-offscreen">$24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const driver: CollectorDriver = { openProduct: vi.fn(async () => product), search: vi.fn(async () => '') };
    const result = await collectDoll({
      type: 'refresh-doll', requestId: 'request-3', dataDir: 'C:/data', doll: { id: 'doll-1', name: 'Willow Thorne', mattelSku: 'JMB92' },
      knownListings: [{ region: 'amazon_us', asin: 'B0CXYZ1234', url: 'https://www.amazon.com/dp/B0CXYZ1234', confirmed: true }], regions: ['amazon_us'],
      catalogRules: { mattelSku: 'JMB92', requiredTerms: ['Willow Thorne'], rejectTerms: ['outfit'] },
    }, driver, vi.fn());

    expect(result.regions.amazon_us).toMatchObject({ status: 'no_price', asin: null });
  });
});
