import { describe, expect, it, vi } from 'vitest';

import { CatalogScanService } from '@/main/catalog/scan-service';

describe('CatalogScanService', () => {
  it('runs only official Store import and schedules the next Store check two hours later', async () => {
    const scheduled = vi.fn();
    const refreshCatalogEntry = vi.fn();
    const officialStoreImport = { run: vi.fn(async (_regions: readonly string[], progress?: (event: { region: 'amazon_it'; processed: number; total: number }) => void) => {
      progress?.({ region: 'amazon_it', processed: 3, total: 10 });
      return { errors: [] };
    }) };
    const service = new CatalogScanService({
      officialStoreImport,
      schedule: scheduled, clearSchedule: vi.fn(), now: () => new Date('2026-07-10T10:00:00.000Z'),
    });

    await service.runNow();

    expect(officialStoreImport.run).toHaveBeenCalledWith(['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it'], expect.any(Function));
    expect(refreshCatalogEntry).not.toHaveBeenCalled();
    expect(scheduled).toHaveBeenCalledWith(expect.any(Function), 120 * 60 * 1000);
    expect(service.getState()).toMatchObject({ status: 'idle', phase: 'official_store', region: 'amazon_it', processed: 3, total: 10, nextRunAt: '2026-07-10T12:00:00.000Z' });
  });

  it('does not launch an Amazon scan merely because the application starts', () => {
    const officialStoreImport = { run: vi.fn() };
    const service = new CatalogScanService({ officialStoreImport });

    service.start();

    expect(officialStoreImport.run).not.toHaveBeenCalled();
  });

  it('returns the in-progress state instead of overlapping and clears its timer on dispose', async () => {
    let resolveImport: (() => void) | undefined;
    const first = new Promise<{ errors: string[] }>((resolve) => { resolveImport = () => resolve({ errors: [] }); });
    const clearSchedule = vi.fn();
    const service = new CatalogScanService({
      officialStoreImport: { run: vi.fn(() => first) },
      schedule: vi.fn(() => 1 as unknown as ReturnType<typeof setTimeout>), clearSchedule, now: () => new Date('2026-07-10T10:00:00.000Z'),
    });

    const run = service.runNow();
    await expect(service.runNow()).resolves.toMatchObject({ status: 'running' });
    resolveImport?.();
    await run;
    service.dispose();
    expect(clearSchedule).toHaveBeenCalledWith(1 as unknown as ReturnType<typeof setTimeout>);
  });

  it('keeps a short safe Store error in scan state', async () => {
    const service = new CatalogScanService({
      officialStoreImport: { run: vi.fn(async () => ({ errors: ['amazon_it: Store browser session ended'] })) },
      schedule: vi.fn(), clearSchedule: vi.fn(), now: () => new Date('2026-07-10T10:00:00.000Z'),
    });

    await service.runNow();

    expect(service.getState()).toMatchObject({ status: 'idle', lastError: 'amazon_it: Store browser session ended' });
  });
});
