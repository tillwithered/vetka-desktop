import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfficialStoreImportService } from '@/main/catalog/official-store-import-service';
import { CatalogRepository } from '@/main/catalog/repository';
import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { PriceRepository } from '@/main/prices/repository';
import { PriceService } from '@/main/prices/service';
import type { OfficialStoreDoll } from '@/collector/amazon/store';

const robeccaFromUkStore: OfficialStoreDoll = {
  region: 'amazon_uk' as const,
  asin: 'B0FK1V67X5',
  url: 'https://www.amazon.co.uk/dp/B0FK1V67X5',
  name: 'Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59',
  mattelSku: 'JHK59',
  imageUrl: 'https://images.example/robecca.jpg',
  price: { minor: 2499, currency: 'GBP' },
  availability: 'in_stock' as const,
  seller: null,
  fulfilledByAmazon: false,
};

describe('OfficialStoreImportService', () => {
  let db: DatabaseSync;
  afterEach(() => db?.close());

  function setUp() {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    const dolls = new DollRepository(db);
    const catalog = new CatalogRepository(db, dolls);
    const prices = new PriceRepository(db);
    const priceService = new PriceService({ db, prices, collector: { refreshDoll: vi.fn() }, dataDir: 'C:/data', getRate: () => 650_000_000 });
    return { dolls, catalog, prices, priceService };
  }

  it('imports an official Store doll and its regional price by SKU through the collector worker', async () => {
    const { catalog, prices, priceService } = setUp();
    const collector = { importOfficialStore: vi.fn(async () => ({ requestId: 'store-1', products: [robeccaFromUkStore], regions: { amazon_uk: { status: 'completed' as const, total: 1 } } })) };
    const service = new OfficialStoreImportService({ catalog, priceService, collector, dataDir: 'C:/data', now: () => new Date('2026-07-11T00:00:00.000Z') });

    const result = await service.run(['amazon_uk']);

    const entry = catalog.listAll().find((candidate) => candidate.mattelSku === 'JHK59');
    expect(result).toEqual({ imported: 1, updated: 0, skipped: 0 });
    expect(entry).toMatchObject({ sourceUrl: 'https://www.amazon.co.uk/dp/B0FK1V67X5', monitorStatus: 'monitor_only' });
    expect(prices.current(entry!.dollId!)).toContainEqual(expect.objectContaining({ region: 'amazon_uk', priceMinor: 2499, currency: 'GBP' }));
    expect(collector.importOfficialStore).toHaveBeenCalledWith({ dataDir: 'C:/data', regions: ['amazon_uk'] }, expect.any(Function));
  });

  it('reports a blocked Store region without deleting or interrupting other regions', async () => {
    const { catalog, priceService } = setUp();
    const collector = { importOfficialStore: vi.fn(async () => ({ requestId: 'store-1', products: [], regions: { amazon_uk: { status: 'blocked' as const, total: 0, error: 'Amazon temporarily blocked Store import' } } })) };
    const service = new OfficialStoreImportService({ catalog, priceService, collector, dataDir: 'C:/data' });

    await expect(service.run(['amazon_uk'])).resolves.toMatchObject({ imported: 0, errors: [expect.stringMatching(/amazon_uk/i)] });
    expect(catalog.listAll()).toEqual([]);
  });

  it('does not replace a manually chosen doll image during Store enrichment', async () => {
    const { dolls, catalog, priceService } = setUp();
    const existing = dolls.create({ name: 'Robecca Steam', mattelSku: 'JHK59', imagePath: 'C:/manual/robecca.jpg' });
    const collector = { importOfficialStore: vi.fn(async () => ({ requestId: 'store-1', products: [robeccaFromUkStore], regions: { amazon_uk: { status: 'completed' as const, total: 1 } } })) };
    const service = new OfficialStoreImportService({ catalog, priceService, collector, dataDir: 'C:/data' });

    await service.run(['amazon_uk']);

    expect(dolls.get(existing.id)?.imagePath).toBe('C:/manual/robecca.jpg');
  });
});
