import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CollectiblesRepository } from '@/main/collectibles/repository';
import { CollectiblesService } from '@/main/collectibles/service';
import type { CollectedProduct } from '@/main/collectibles/client';
import { runMigrations } from '@/main/db/migrate';

const product: CollectedProduct = {
  mattelSku: 'JKM54',
  canonicalUrl: 'https://creations.mattel.com/products/gozer-jkm54',
  nameRu: 'Гозер — Skullector',
  officialName: 'Monster High Skullector Ghostbusters Gozer Doll',
  lineName: 'Skullector x Ghostbusters',
  priceMinor: 7000,
  currency: 'USD',
  lifecycle: 'in_stock' as const,
  saleStartsAt: null,
  fangClubOnly: false,
  imageUrl: 'https://cdn.shopify.com/gozer.jpg',
  checkedAt: '2026-07-12T00:00:00.000Z',
};

let db: DatabaseSync;
let repository: CollectiblesRepository;

beforeEach(() => {
  vi.useFakeTimers();
  db = new DatabaseSync(':memory:');
  runMigrations(db);
  repository = new CollectiblesRepository(db);
});

afterEach(() => {
  vi.useRealTimers();
  db.close();
});

describe('CollectiblesService', () => {
  it('runs once when due and schedules 24 hours from completion', async () => {
    const collect = vi.fn(async () => ({ complete: true, products: [product], errors: [] }));
    const now = vi.fn(() => new Date('2026-07-12T00:00:00.000Z'));
    const service = new CollectiblesService({ repository, client: { collect }, now, schedule: setTimeout });

    service.start();
    await vi.runOnlyPendingTimersAsync();

    expect(collect).toHaveBeenCalledOnce();
    expect(repository.list()).toHaveLength(1);
    expect(repository.getScanState()).toMatchObject({
      status: 'idle', completedAt: '2026-07-12T00:00:00.000Z', nextRunAt: '2026-07-13T00:00:00.000Z',
    });
    service.dispose();
  });

  it('keeps partial successes and records failed known products', async () => {
    repository.upsert({ ...product, mattelSku: 'OLD1', canonicalUrl: 'https://creations.mattel.com/products/old' });
    const collect = vi.fn(async () => ({
      complete: true,
      products: [product],
      errors: [{ url: 'https://creations.mattel.com/products/old', message: 'failed' }],
    }));
    const service = new CollectiblesService({ repository, client: { collect }, now: () => new Date('2026-07-13T00:00:00.000Z') });

    await service.runNow();
    await service.runNow();

    expect(repository.list()).toHaveLength(2);
    expect(repository.list().find((item) => item.canonicalUrl.endsWith('/old'))).toMatchObject({ lastCheckResult: 'error' });
    expect(service.getState().lastError).toContain('1');
  });

  it('does not archive from an incomplete collection scan', async () => {
    repository.upsert(product);
    const service = new CollectiblesService({
      repository,
      client: { collect: vi.fn(async () => ({ complete: false, products: [], errors: [{ url: 'collection', message: 'offline' }] })) },
      now: () => new Date('2026-07-13T00:00:00.000Z'),
    });

    await service.runNow();
    await service.runNow();

    expect(repository.list({ archived: false })).toHaveLength(1);
  });

  it('leaves running state and schedules a retry when collection throws', async () => {
    const service = new CollectiblesService({
      repository,
      client: { collect: vi.fn(async () => { throw new Error('Mattel parser crashed'); }) },
      now: () => new Date('2026-07-13T00:00:00.000Z'),
    });

    await expect(service.runNow()).resolves.toMatchObject({
      status: 'idle',
      completedAt: '2026-07-13T00:00:00.000Z',
      nextRunAt: '2026-07-13T01:00:00.000Z',
      lastError: 'Mattel parser crashed',
    });
    expect(repository.getScanState().status).toBe('idle');
  });
});
