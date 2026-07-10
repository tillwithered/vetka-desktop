import { describe, expect, it, vi } from 'vitest';

import { CatalogScanService } from '@/main/catalog/scan-service';
import type { CatalogEntry } from '@/main/catalog/repository';

const entry: CatalogEntry = {
  mattelSku: 'JMB92', name: 'Willow Thorne', characterName: 'Willow Thorne', lineName: 'Moonspell Magic',
  productType: 'regular', monitorStatus: 'active', requiredTerms: ['Willow Thorne'], rejectTerms: ['outfit'],
  searchQuery: 'Monster High JMB92', sourceUrl: null, sourceCheckedAt: '2026-07-10', evidence: 'test', dollId: 'doll-1',
};

describe('CatalogScanService', () => {
  it('runs active catalog entries and schedules the next run two hours after completion', async () => {
    const scheduled = vi.fn();
    const refreshCatalogEntry = vi.fn(async () => undefined);
    const service = new CatalogScanService({
      catalog: { listActive: () => [entry] }, priceService: { refreshCatalogEntry },
      schedule: scheduled, clearSchedule: vi.fn(), now: () => new Date('2026-07-10T10:00:00.000Z'),
    });

    await service.runNow();

    expect(refreshCatalogEntry).toHaveBeenCalledWith(entry, ['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es']);
    expect(scheduled).toHaveBeenCalledWith(expect.any(Function), 120 * 60 * 1000);
    expect(service.getState()).toMatchObject({ status: 'idle', processed: 1, total: 1, nextRunAt: '2026-07-10T12:00:00.000Z' });
  });

  it('returns the in-progress state instead of overlapping and clears its timer on dispose', async () => {
    let resolveRefresh: (() => void) | undefined;
    const first = new Promise<void>((resolve) => { resolveRefresh = resolve; });
    const clearSchedule = vi.fn();
    const service = new CatalogScanService({
      catalog: { listActive: () => [entry] }, priceService: { refreshCatalogEntry: vi.fn(() => first) },
      schedule: vi.fn(() => 1 as unknown as ReturnType<typeof setTimeout>), clearSchedule, now: () => new Date('2026-07-10T10:00:00.000Z'),
    });

    const run = service.runNow();
    await expect(service.runNow()).resolves.toMatchObject({ status: 'running' });
    resolveRefresh?.();
    await run;
    service.dispose();
    expect(clearSchedule).toHaveBeenCalledWith(1 as unknown as ReturnType<typeof setTimeout>);
  });

  it('keeps the latest per-entry error in scan state', async () => {
    const service = new CatalogScanService({
      catalog: { listActive: () => [entry] },
      priceService: { refreshCatalogEntry: vi.fn(async () => { throw new Error('Collector worker exited'); }) },
      schedule: vi.fn(), clearSchedule: vi.fn(), now: () => new Date('2026-07-10T10:00:00.000Z'),
    });

    await service.runNow();

    expect(service.getState()).toMatchObject({ status: 'idle', lastError: 'Collector worker exited' });
  });
});
