import { describe, expect, it, vi } from 'vitest';

import { collectOfficialStore } from '@/collector/amazon/store-collect';

describe('official Store collection', () => {
  it('keeps a verified price from the Store card and skips its product page', async () => {
    const storeHtml = `
      <article data-asin="B0FK1V67X5">
        <a href="/Monster-High-Robecca/dp/B0FK1V67X5"><img src="https://images.example/robecca.jpg" alt="Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59"></a>
        <h2>Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</h2>
        <span class="a-offscreen">£24.99</span>
      </article>`;
    const driver = {
      openStore: vi.fn(async () => storeHtml),
      openStoreProduct: vi.fn(async () => ''),
    };

    const result = await collectOfficialStore({ requestId: 'request-1', regions: ['amazon_uk'], driver });

    expect(result.products).toMatchObject([{ asin: 'B0FK1V67X5', mattelSku: 'JHK59', price: { minor: 2499, currency: 'GBP' } }]);
    expect(driver.openStoreProduct).not.toHaveBeenCalled();
    expect(result.regions.amazon_uk).toEqual({ status: 'completed', total: 1 });
  });

  it('uses the proxy Store request only after the direct Store request receives CAPTCHA', async () => {
    const storeHtml = `
      <article data-asin="B0FK1V67X5">
        <a href="/Monster-High-Robecca/dp/B0FK1V67X5"><img src="https://images.example/robecca.jpg" alt="Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59"></a>
        <h2>Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</h2>
        <span class="a-offscreen">£24.99</span>
      </article>`;
    const driver = {
      openStore: vi.fn().mockResolvedValueOnce('<form action="/errors/validateCaptcha"></form>').mockResolvedValueOnce(storeHtml),
      openStoreViaProxy: vi.fn(async () => storeHtml),
      openStoreProduct: vi.fn(async () => ''),
      hasProxyRoute: vi.fn(() => true),
    };

    const result = await collectOfficialStore({ requestId: 'request-2', regions: ['amazon_uk'], driver });

    expect(driver.openStore).toHaveBeenCalledOnce();
    expect(driver.openStoreViaProxy).toHaveBeenCalledOnce();
    expect(result.products).toMatchObject([{ asin: 'B0FK1V67X5', price: { minor: 2499, currency: 'GBP' } }]);
    expect(result.regions.amazon_uk).toEqual({ status: 'completed', total: 1 });
  });

  it('reports an unusable Store response instead of completing with zero collectible cards', async () => {
    const driver = {
      openStore: vi.fn(async () => '<html><body><h1>Monster High Store</h1></body></html>'),
      openStoreProduct: vi.fn(async () => ''),
    };

    const result = await collectOfficialStore({ requestId: 'request-empty', regions: ['amazon_uk'], driver });

    expect(result.regions.amazon_uk).toEqual({
      status: 'failed',
      total: 0,
      error: 'Store page did not contain product links',
    });
  });
});
