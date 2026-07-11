import { describe, expect, it, vi } from 'vitest';

import { CatalogScanService, DAILY_PRICE_CHECK_MS, OVERDUE_PRICE_CHECK_DELAY_MS } from '@/main/catalog/scan-service';
import type { CatalogScanState } from '@/main/catalog/scan-service';

const now = () => new Date('2026-07-10T10:00:00.000Z');
const idleState: CatalogScanState = {
  status: 'idle' as const,
  phase: null,
  region: null,
  startedAt: null,
  completedAt: null,
  nextRunAt: null,
  processed: 0,
  total: 0,
  lastError: null,
};

describe('CatalogScanService', () => {
  it('refreshes confirmed ASINs without importing an Amazon Store and schedules tomorrow', async () => {
    const scheduled = vi.fn();
    const asinPriceRefresh = { run: vi.fn(async (_regions: readonly string[], progress?: (event: { processed: number; total: number }) => void) => {
      progress?.({ processed: 2, total: 2 });
      return { processed: 2, total: 2, errors: [] };
    }) };
    const service = new CatalogScanService({
      asinPriceRefresh,
      regions: () => ['amazon_de', 'amazon_uk'],
      schedule: scheduled,
      clearSchedule: vi.fn(),
      now,
    });

    await service.runNow();

    expect(asinPriceRefresh.run).toHaveBeenCalledWith(['amazon_de', 'amazon_uk'], expect.any(Function));
    expect(scheduled).toHaveBeenCalledWith(expect.any(Function), DAILY_PRICE_CHECK_MS);
    expect(service.getState()).toMatchObject({
      status: 'idle', phase: 'catalog_scan', processed: 2, total: 2,
      nextRunAt: '2026-07-11T10:00:00.000Z', lastError: null,
    });
  });

  it('schedules a fresh catalog one day after application start without an immediate scan', () => {
    const scheduled = vi.fn();
    const asinPriceRefresh = { run: vi.fn() };
    const service = new CatalogScanService({ asinPriceRefresh, schedule: scheduled, clearSchedule: vi.fn(), now });

    service.start();

    expect(asinPriceRefresh.run).not.toHaveBeenCalled();
    expect(scheduled).toHaveBeenCalledWith(expect.any(Function), DAILY_PRICE_CHECK_MS);
    expect(service.getState().nextRunAt).toBe('2026-07-11T10:00:00.000Z');
  });

  it('defers exactly one overdue price scan after application start', () => {
    const scheduled = vi.fn();
    const asinPriceRefresh = { run: vi.fn() };
    const service = new CatalogScanService({
      asinPriceRefresh,
      initialState: { ...idleState, completedAt: '2026-07-09T10:00:00.000Z' },
      schedule: scheduled,
      clearSchedule: vi.fn(),
      now,
    });

    service.start();

    expect(asinPriceRefresh.run).not.toHaveBeenCalled();
    expect(scheduled).toHaveBeenCalledWith(expect.any(Function), OVERDUE_PRICE_CHECK_DELAY_MS);
    expect(service.getState().nextRunAt).toBe('2026-07-10T10:01:00.000Z');
  });

  it('waits only until the regular daily due time when the previous check is fresh', () => {
    const scheduled = vi.fn();
    const service = new CatalogScanService({
      asinPriceRefresh: { run: vi.fn() },
      initialState: { ...idleState, completedAt: '2026-07-10T04:00:00.000Z' },
      schedule: scheduled,
      clearSchedule: vi.fn(),
      now,
    });

    service.start();

    expect(scheduled).toHaveBeenCalledWith(expect.any(Function), 18 * 60 * 60 * 1000);
  });

  it('does not overlap a manual run and clears a scheduled timer before it begins', async () => {
    let resolveRefresh: (() => void) | undefined;
    const pending = new Promise<{ processed: number; total: number; errors: string[] }>((resolve) => { resolveRefresh = () => resolve({ processed: 1, total: 1, errors: [] }); });
    const clearSchedule = vi.fn();
    const service = new CatalogScanService({
      asinPriceRefresh: { run: vi.fn(() => pending) },
      schedule: vi.fn(() => 1 as unknown as ReturnType<typeof setTimeout>),
      clearSchedule,
      now,
    });
    service.start();

    const first = service.runNow();
    await expect(service.runNow()).resolves.toMatchObject({ status: 'running' });
    resolveRefresh?.();
    await first;

    expect(clearSchedule).toHaveBeenCalledWith(1 as unknown as ReturnType<typeof setTimeout>);
  });

  it('keeps a concise price refresh error and schedules the next daily attempt', async () => {
    const scheduled = vi.fn();
    const service = new CatalogScanService({
      asinPriceRefresh: { run: vi.fn(async () => ({ processed: 1, total: 1, errors: ['JHK59: price refresh failed'] })) },
      schedule: scheduled,
      clearSchedule: vi.fn(),
      now,
    });

    await service.runNow();

    expect(service.getState()).toMatchObject({ lastError: 'JHK59: price refresh failed', nextRunAt: '2026-07-11T10:00:00.000Z' });
  });

  it('does not run a catalog check when no Amazon regions are selected', async () => {
    const asinPriceRefresh = { run: vi.fn() };
    const service = new CatalogScanService({ asinPriceRefresh, regions: () => [], schedule: vi.fn(), clearSchedule: vi.fn(), now });

    await service.runNow();

    expect(asinPriceRefresh.run).not.toHaveBeenCalled();
    expect(service.getState().lastError).toBe('No Amazon regions are configured');
  });
});
