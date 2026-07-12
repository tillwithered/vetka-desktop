import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { PriceRepository } from '@/main/prices/repository';
import { PriceService } from '@/main/prices/service';
import type { CatalogEntry } from '@/main/catalog/repository';
import type { CollectorDollResult, CollectorRequestInput } from '@/collector/contracts';

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
      knownAsinsOnly: true,
      catalogRules: { mattelSku: 'JMB92', upcEan: null, searchQuery: 'Monster High JMB92', requiredTerms: ['Willow Thorne'], rejectTerms: ['outfit'] },
    }));
  });

  it('confirms a fact-triangle catalog match so its verified price is visible', async () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const doll = new DollRepository(db).create({ name: 'Willow Thorne', mattelSku: 'JMB92' });
    const prices = new PriceRepository(db);
    const collector = { refreshDoll: vi.fn(async () => ({
      requestId: 'catalog-price',
      regions: { amazon_us: { status: 'verified', region: 'amazon_us', asin: 'B0CXYZ1234', title: 'Monster High Willow Thorne', regularPrice: { minor: 2499, currency: 'USD' as const }, primePrice: null, subscriptionPrice: null, couponText: null, seller: 'Amazon.com', fulfilledByAmazon: true, availability: 'in_stock' as const, condition: 'New' as const, url: 'https://www.amazon.com/dp/B0CXYZ1234', reviewCandidates: [], matchDiagnostic: { status: 'verified' as const, score: 100, reason: 'fact_triangle' } } },
    } as CollectorDollResult)) };
    const service = new PriceService({ db, prices, collector, dataDir: 'C:/data', getRate: () => 514_200_000 });
    const entry: CatalogEntry = { mattelSku: 'JMB92', name: 'Willow Thorne', characterName: 'Willow Thorne', lineName: 'Moonspell Magic', productType: 'regular', monitorStatus: 'active', requiredTerms: ['Willow Thorne'], rejectTerms: ['outfit'], searchQuery: 'Monster High JMB92', sourceUrl: null, sourceCheckedAt: '2026-07-10', evidence: 'test', dollId: doll.id };

    await service.refreshCatalogEntry(entry, ['amazon_us']);

    expect(prices.getByIdentity(doll.id, 'amazon_us', 'B0CXYZ1234')).toMatchObject({ status: 'confirmed', confirmationSource: 'deterministic_match' });
    expect(prices.current(doll.id)).toHaveLength(1);
  });

  it('checks confirmed regions first and persists each region without waiting for discovery', async () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const doll = new DollRepository(db).create({ name: 'Catty Noir', mattelSku: 'HXH76' });
    const prices = new PriceRepository(db);
    prices.ensureListing({ dollId: doll.id, region: 'amazon_es', asin: 'B0CMGDLQC9', url: 'https://www.amazon.es/dp/B0CMGDLQC9', status: 'confirmed', confirmationSource: 'exact_id' });
    const collector = {
      refreshDoll: vi.fn(async (input: CollectorRequestInput) => {
        const region = input.regions[0] === 'amazon_es' ? 'amazon_es' : 'amazon_us';
        return {
          requestId: `request-${region}`,
          regions: region === 'amazon_es'
            ? { amazon_es: { status: 'verified', region, asin: 'B0CMGDLQC9', title: 'Catty Noir HXH76', regularPrice: { minor: 3499, currency: 'EUR' as const }, primePrice: null, subscriptionPrice: null, couponText: null, seller: 'Amazon.es', fulfilledByAmazon: true, availability: 'in_stock' as const, condition: 'New' as const, url: 'https://www.amazon.es/dp/B0CMGDLQC9', reviewCandidates: [] } }
            : { amazon_us: { status: 'no_price', region, asin: null, title: null, regularPrice: null, primePrice: null, subscriptionPrice: null, couponText: null, seller: null, fulfilledByAmazon: false, availability: null, condition: null, url: null, reviewCandidates: [] } },
        } as CollectorDollResult;
      }),
    };
    const service = new PriceService({ db, prices, collector, dataDir: 'C:/data', getRate: () => 600_000_000 });

    await service.refreshDoll(doll.id, ['amazon_us', 'amazon_es']);

    expect(collector.refreshDoll).toHaveBeenNthCalledWith(1, expect.objectContaining({ regions: ['amazon_es'] }));
    expect(collector.refreshDoll).toHaveBeenNthCalledWith(2, expect.objectContaining({ regions: ['amazon_us'] }));
    expect(prices.current(doll.id)).toContainEqual(expect.objectContaining({ asin: 'B0CMGDLQC9', priceMinor: 3499 }));
  });

  it('records a no-price check for a confirmed listing instead of leaving the result invisible', async () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const doll = new DollRepository(db).create({ name: 'Catty Noir' });
    const prices = new PriceRepository(db);
    const listing = prices.ensureListing({ dollId: doll.id, region: 'amazon_es', asin: 'B0CMGDLQC9', url: 'https://www.amazon.es/dp/B0CMGDLQC9', status: 'confirmed', confirmationSource: 'exact_id' });
    const collector = { refreshDoll: vi.fn(async () => ({
      requestId: 'no-price',
      regions: { amazon_es: { status: 'no_price', region: 'amazon_es', asin: null, title: null, regularPrice: null, primePrice: null, subscriptionPrice: null, couponText: null, seller: null, fulfilledByAmazon: false, availability: null, condition: null, url: null, reviewCandidates: [] } },
    } as CollectorDollResult)) };
    const service = new PriceService({ db, prices, collector, dataDir: 'C:/data', getRate: () => 600_000_000 });

    await service.refreshDoll(doll.id, ['amazon_es']);

    expect(db.prepare('select status from price_checks where listing_id = ?').get(listing.id)).toEqual({ status: 'no_price' });
  });

  it('records a blocked check without replacing the last verified offer', async () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const doll = new DollRepository(db).create({ name: 'Robecca Steam' });
    const prices = new PriceRepository(db);
    const listing = prices.ensureListing({ dollId: doll.id, region: 'amazon_uk', asin: 'B0FK1V67X5', url: 'https://www.amazon.co.uk/dp/B0FK1V67X5', status: 'confirmed', confirmationSource: 'exact_id' });
    prices.applyCheck({
      listingId: listing.id, status: 'verified', checkedAt: '2026-07-10T00:00:00.000Z', diagnostic: {},
      offer: { offerKind: 'regular', priceMinor: 2499, currency: 'GBP', shippingMinor: null, sellerName: 'Amazon', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 650_000_000 },
    });
    const collector = { refreshDoll: vi.fn(async () => ({
      requestId: 'blocked',
      regions: { amazon_uk: { status: 'blocked', region: 'amazon_uk', asin: null, title: null, regularPrice: null, primePrice: null, subscriptionPrice: null, couponText: null, seller: null, fulfilledByAmazon: false, availability: null, condition: null, url: null, reviewCandidates: [] } },
    } as CollectorDollResult)) };
    const service = new PriceService({ db, prices, collector, dataDir: 'C:/data', getRate: () => 650_000_000 });

    await service.refreshDoll(doll.id, ['amazon_uk']);

    expect(db.prepare('select status from price_checks where listing_id = ? order by finished_at desc limit 1').get(listing.id)).toEqual({ status: 'blocked' });
    expect(prices.current(doll.id)).toContainEqual(expect.objectContaining({ priceMinor: 2499, currency: 'GBP' }));
  });

  it('saves a confirmed Amazon thumbnail without replacing a manual image', async () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const dolls = new DollRepository(db);
    const doll = dolls.create({ name: 'Draculaura' });
    const prices = new PriceRepository(db);
    prices.ensureListing({ dollId: doll.id, region: 'amazon_us', asin: 'B0CXYZ1234', url: 'https://www.amazon.com/dp/B0CXYZ1234', status: 'confirmed' });
    const collector = { refreshDoll: vi.fn(async () => ({ requestId: 'thumbnail', regions: { amazon_us: { status: 'verified', region: 'amazon_us', asin: 'B0CXYZ1234', title: 'Draculaura', imageUrl: 'https://images.example/auto.jpg', regularPrice: { minor: 2499, currency: 'USD' as const }, primePrice: null, subscriptionPrice: null, couponText: null, seller: null, fulfilledByAmazon: true, availability: 'in_stock' as const, condition: 'New' as const, url: 'https://www.amazon.com/dp/B0CXYZ1234', reviewCandidates: [] } } } as CollectorDollResult)) };
    const service = new PriceService({ db, prices, collector, dataDir: 'C:/data', getRate: () => 514_200_000 });
    await service.refreshDoll(doll.id, ['amazon_us']);
    expect(dolls.get(doll.id)).toMatchObject({ imagePath: 'https://images.example/auto.jpg', imageSource: 'amazon' });
    dolls.update(doll.id, { imagePath: 'C:/manual.jpg' });
    await service.refreshDoll(doll.id, ['amazon_us']);
    expect(dolls.get(doll.id)?.imagePath).toBe('C:/manual.jpg');
  });

  it('persists a Store-card price whose stock state has not been opened on a product page', () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const doll = new DollRepository(db).create({ name: 'Robecca Steam', mattelSku: 'JHK59' });
    const prices = new PriceRepository(db);
    const service = new PriceService({
      db, prices, collector: { refreshDoll: vi.fn() }, dataDir: 'C:/data', getRate: () => 650_000_000,
    });

    service.persistOfficialStoreOffer(doll.id, {
      region: 'amazon_uk', asin: 'B0FK1V67X5', url: 'https://www.amazon.co.uk/dp/B0FK1V67X5',
      name: 'Monster High Robecca Steam Boo-riginal Creeproduction Doll JHK59', mattelSku: 'JHK59',
      imageUrl: null, price: { minor: 2499, currency: 'GBP' }, seller: null,
      fulfilledByAmazon: false, availability: 'unknown',
    });

    expect(prices.current(doll.id)).toContainEqual(expect.objectContaining({
      priceMinor: 2499, currency: 'GBP', availability: 'unknown',
    }));
  });
});
