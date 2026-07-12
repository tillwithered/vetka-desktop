import { describe, expect, it, vi } from 'vitest';

import { AsinPriceRefreshService } from '@/main/catalog/asin-price-refresh-service';

describe('AsinPriceRefreshService', () => {
  it('refreshes every doll with a confirmed ASIN, including Store-imported and monitor-only cards', async () => {
    const confirmed = { mattelSku: 'JHK59', dollId: 'robecca', monitorStatus: 'monitor_only' as const };
    const refreshCatalogEntry = vi.fn(async () => undefined);
    const refreshDoll = vi.fn(async () => undefined);
    const progress = vi.fn();
    const service = new AsinPriceRefreshService({
      catalog: { listAll: () => [confirmed] as never[] },
      prices: { listDollIdsWithConfirmedListings: () => ['robecca', 'store-imported'] },
      priceService: { refreshCatalogEntry, refreshDoll },
    });

    await expect(service.run(['amazon_uk'], progress)).resolves.toEqual({ processed: 2, total: 2, errors: [] });
    expect(refreshCatalogEntry).toHaveBeenCalledWith(confirmed, ['amazon_uk']);
    expect(refreshDoll).toHaveBeenCalledWith('store-imported', ['amazon_uk']);
    expect(progress).toHaveBeenCalledWith({ processed: 1, total: 2, dollId: 'robecca', entry: confirmed });
  });
});
