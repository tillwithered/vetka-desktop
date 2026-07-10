import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CatalogRepository } from '@/main/catalog/repository';
import { DollRepository } from '@/main/dolls/repository';
import { runMigrations } from '@/main/db/migrate';
import { OfficialStoreImportService } from '@/main/catalog/official-store-import-service';
import { PriceRepository } from '@/main/prices/repository';
import { PriceService } from '@/main/prices/service';

describe('OfficialStoreImportService', () => {
  let db: DatabaseSync;
  afterEach(() => db?.close());

  it('imports an official Store doll and its regional price by SKU', async () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const dolls = new DollRepository(db);
    const catalog = new CatalogRepository(db, dolls);
    const prices = new PriceRepository(db);
    const priceService = new PriceService({ db, prices, collector: { refreshDoll: vi.fn() }, dataDir: 'C:/data', getRate: () => 650_000_000 });
    const product = '<input id="ASIN" value="B0FK1V67X5"><span id="productTitle">Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59</span><img id="landingImage" src="https://images.example/robecca.jpg"><div id="corePrice_feature_div"><span class="a-offscreen">£24.99</span></div><div id="availability">In Stock</div><div id="condition">New</div>';
    const driver = { openStore: vi.fn(async () => '<a href="/Monster-High-Robecca/dp/B0FK1V67X5">Robecca</a>'), openProduct: vi.fn(async () => product), close: vi.fn(async () => undefined) };
    const service = new OfficialStoreImportService({ catalog, prices, priceService, driver, now: () => new Date('2026-07-11T00:00:00.000Z') });

    const result = await service.run(['amazon_uk']);

    const entry = catalog.listAll().find((candidate) => candidate.mattelSku === 'JHK59');
    expect(result).toEqual({ imported: 1, updated: 0, skipped: 0 });
    expect(entry).toMatchObject({ sourceUrl: 'https://www.amazon.co.uk/dp/B0FK1V67X5', monitorStatus: 'monitor_only' });
    expect(prices.current(entry!.dollId!)).toContainEqual(expect.objectContaining({ region: 'amazon_uk', priceMinor: 2499, currency: 'GBP' }));
  });
});
