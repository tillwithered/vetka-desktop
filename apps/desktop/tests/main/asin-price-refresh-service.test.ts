import { describe, expect, it, vi } from 'vitest';

import { AsinPriceRefreshService } from '@/main/catalog/asin-price-refresh-service';

describe('AsinPriceRefreshService', () => {
  it('refreshes every active catalog entry plus confirmed monitor-only and Store-imported cards', async () => {
    const confirmed = { mattelSku: 'JHK59', dollId: 'robecca', monitorStatus: 'monitor_only' as const };
    const newRelease = { mattelSku: 'JMG63', dollId: 'ultimate-skulltimate', monitorStatus: 'active' as const };
    const inactiveWithoutListing = { mattelSku: 'OLD1', dollId: 'inactive', monitorStatus: 'monitor_only' as const };
    const refreshCatalogEntry = vi.fn(async () => undefined);
    const refreshDoll = vi.fn(async () => undefined);
    const progress = vi.fn();
    const service = new AsinPriceRefreshService({
      catalog: { listAll: () => [confirmed, newRelease, inactiveWithoutListing] as never[] },
      prices: { listDollIdsWithConfirmedListings: () => ['robecca', 'store-imported'] },
      priceService: { refreshCatalogEntry, refreshDoll },
    });

    await expect(service.run(['amazon_uk'], progress)).resolves.toEqual({ processed: 3, total: 3, errors: [] });
    expect(refreshCatalogEntry).toHaveBeenCalledWith(confirmed, ['amazon_uk']);
    expect(refreshCatalogEntry).toHaveBeenCalledWith(newRelease, ['amazon_uk']);
    expect(refreshCatalogEntry).not.toHaveBeenCalledWith(inactiveWithoutListing, expect.anything());
    expect(refreshDoll).toHaveBeenCalledWith('store-imported', ['amazon_uk']);
    expect(progress).toHaveBeenCalledWith({ processed: 1, total: 3, dollId: 'robecca', entry: confirmed });
  });
});
