import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { PriceRepository } from '@/main/prices/repository';
import { PriceService } from '@/main/prices/service';
import type { CatalogEntry } from '@/main/catalog/repository';
import type { CollectorDollResult } from '@/collector/contracts';

describe('PriceService', () => {
  let db: DatabaseSync;
  afterEach(() => db?.close());

  it('persists the collector result with the configured exchange rate', async () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const doll = new DollRepository(db).create({ name: 'Draculaura' });
    const prices = new PriceRepository(db);
    prices.ensureListing({ dollId: doll.id, region: 'amazon_us', asin: 'B0CXYZ1234', url: 'https://www.amazon.com/dp/B0CXYZ1234', status: 'confirmed', confirmationSource: 'manual' });
    const collectorResult: CollectorDollResult = { requestId: 'r1', regions: { amazon_us: { status: 'verified', region: 'amazon_us', asin: 'B0CXYZ1234', title: 'Draculaura', regularPrice: { minor: 2499, currency: 'USD' }, primePrice: null, subscriptionPrice: null, couponText: null, seller: 'Amazon.com', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', url: 'https://www.amazon.com/dp/B0CXYZ1234', reviewCandidates: [] } } };
    const collector = { refreshDoll: vi.fn(async () => collectorResult) };
    const service = new PriceService({ db, prices, collector, dataDir: 'C:/data', getRate: () => 514_200_000 });

    await service.refreshDoll(doll.id, ['amazon_us']);

    expect(prices.current(doll.id)[0]).toMatchObject({ priceMinor: 2499, priceKztMinor: 1_284_986 });
  });

  it('passes catalog identity rules to the collector without creating candidates', async () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const doll = new DollRepository(db).create({ name: 'Willow Thorne', mattelSku: 'JMB92' });
    const prices = new PriceRepository(db);
    const collector = { refreshDoll: vi.fn(async () => ({ requestId: 'r1', regions: {} })) };
    const service = new PriceService({ db, prices, collector, dataDir: 'C:/data', getRate: () => 514_200_000 });
    const entry: CatalogEntry = { mattelSku: 'JMB92', name: 'Willow Thorne', characterName: 'Willow Thorne', lineName: 'Moonspell Magic', productType: 'regular', monitorStatus: 'active', requiredTerms: ['Willow Thorne'], rejectTerms: ['outfit'], searchQuery: 'Monster High JMB92', sourceUrl: null, sourceCheckedAt: '2026-07-10', evidence: 'test', dollId: doll.id };

    await service.refreshCatalogEntry(entry, ['amazon_us']);

    expect(collector.refreshDoll).toHaveBeenCalledWith(expect.objectContaining({
      doll: expect.objectContaining({ mattelSku: 'JMB92' }),
      catalogRules: { mattelSku: 'JMB92', requiredTerms: ['Willow Thorne'], rejectTerms: ['outfit'] },
    }));
  });
});
