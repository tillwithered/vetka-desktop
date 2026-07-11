import { describe, expect, it, vi } from 'vitest';

import { AsinPriceRefreshService } from '@/main/catalog/asin-price-refresh-service';

describe('AsinPriceRefreshService', () => {
  it('refreshes only active entries with a confirmed ASIN and reports progress', async () => {
    const confirmed = { mattelSku: 'JHK59', dollId: 'robecca', monitorStatus: 'active' as const };
    const unseeded = { mattelSku: 'JMB92', dollId: 'willow', monitorStatus: 'active' as const };
    const refreshCatalogEntry = vi.fn(async () => undefined);
    const progress = vi.fn();
    const service = new AsinPriceRefreshService({
      catalog: { listActive: () => [confirmed, unseeded] as never[] },
      prices: { listListings: (dollId: string) => dollId === 'robecca' ? [{ status: 'confirmed' }] : [] },
      priceService: { refreshCatalogEntry },
    });

    await expect(service.run(['amazon_uk'], progress)).resolves.toEqual({ processed: 1, total: 1, errors: [] });
    expect(refreshCatalogEntry).toHaveBeenCalledWith(confirmed, ['amazon_uk']);
    expect(progress).toHaveBeenCalledWith({ processed: 1, total: 1, entry: confirmed });
  });
});
