import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { PriceRepository } from '@/main/prices/repository';

let db: DatabaseSync;
let prices: PriceRepository;
let dollId: string;
let listingId: string;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  runMigrations(db);
  dollId = new DollRepository(db).create({ name: 'Draculaura' }).id;
  prices = new PriceRepository(db);
  listingId = prices.ensureListing({ dollId, region: 'amazon_us', asin: 'B0CXYZ1234', url: 'https://www.amazon.com/dp/B0CXYZ1234', status: 'confirmed', confirmationSource: 'manual' }).id;
});

afterEach(() => db.close());

describe('PriceRepository', () => {
  it('stores verified snapshots atomically and keeps them current after a later failure', () => {
    prices.applyCheck({ listingId, status: 'verified', checkedAt: '2026-07-10T10:00:00Z', offer: { offerKind: 'regular', priceMinor: 2499, currency: 'USD', shippingMinor: 0, sellerName: 'Amazon.com', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 514_200_000 } });
    prices.applyCheck({ listingId, status: 'captcha_required', checkedAt: '2026-07-10T11:00:00Z', offer: null });

    expect(prices.current(dollId)).toEqual([
      expect.objectContaining({ listingId, priceMinor: 2499, latestCheckStatus: 'captcha_required' }),
    ]);
    expect(db.prepare('select count(*) as count from price_checks').get()).toEqual({ count: 2 });
    expect(db.prepare('select count(*) as count from price_snapshots').get()).toEqual({ count: 1 });
  });

  it('accepts a KZT price rendered by an Amazon global storefront', () => {
    prices.applyCheck({
      listingId,
      status: 'verified',
      checkedAt: '2026-07-10T11:00:00Z',
      offer: {
        offerKind: 'regular', priceMinor: 6_627_671, currency: 'KZT', shippingMinor: 0,
        sellerName: 'Amazon.com', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New',
        couponText: null, rateToKztMicros: 1_000_000,
      },
    });

    expect(prices.current(dollId)).toContainEqual(expect.objectContaining({
      currency: 'KZT', priceKztMinor: 6_627_671,
    }));
  });

  it.each(['captcha_required', 'conflict', 'parser_changed'] as const)('never snapshots %s', (status) => {
    prices.applyCheck({ listingId, status, checkedAt: '2026-07-10T10:00:00Z', offer: null });
    expect(db.prepare('select count(*) as count from price_snapshots').get()).toEqual({ count: 0 });
  });

  it('reviews candidates without deleting their history', () => {
    prices.reviewCandidate(listingId, 'reject');
    expect(prices.getListing(listingId)).toMatchObject({ status: 'rejected' });
    prices.reviewCandidate(listingId, 'confirm');
    expect(prices.getListing(listingId)).toMatchObject({ status: 'confirmed', confirmationSource: 'manual' });
  });

  it('lists each doll that has at least one confirmed ASIN for the daily refresh', () => {
    const secondDollId = new DollRepository(db).create({ name: 'Clawdeen Wolf' }).id;
    prices.ensureListing({ dollId: secondDollId, region: 'amazon_uk', asin: 'B0SEC00001', url: 'https://www.amazon.co.uk/dp/B0SEC00001', status: 'confirmed', confirmationSource: 'manual' });
    prices.ensureListing({ dollId: secondDollId, region: 'amazon_es', asin: 'B0SEC00001', url: 'https://www.amazon.es/dp/B0SEC00001', status: 'candidate' });
    prices.ensureListing({ dollId, region: 'amazon_de', asin: 'B0FROZEN01', url: 'https://www.amazon.de/dp/B0FROZEN01', status: 'frozen' });

    expect(prices.listDollIdsWithConfirmedListings()).toEqual([dollId, secondDollId].sort());
  });

  it('groups current verified offers for multiple dolls in one catalog summary', () => {
    prices.applyCheck({ listingId, status: 'verified', checkedAt: '2026-07-10T10:00:00Z', offer: { offerKind: 'regular', priceMinor: 2499, currency: 'USD', shippingMinor: 0, sellerName: 'Amazon.com', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 514_200_000 } });
    const secondDollId = new DollRepository(db).create({ name: 'Clawdeen Wolf' }).id;

    expect(prices.currentForDolls([dollId, secondDollId])).toEqual({
      [dollId]: [expect.objectContaining({ priceMinor: 2499 })],
      [secondDollId]: [],
    });
  });

  it('promotes legacy verified candidates so existing prices become visible', () => {
    prices.applyCheck({ listingId, status: 'verified', checkedAt: '2026-07-10T10:00:00Z', offer: { offerKind: 'regular', priceMinor: 2499, currency: 'USD', shippingMinor: 0, sellerName: 'Amazon.com', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 514_200_000 } });
    db.prepare('update amazon_listings set status = ?, confirmation_source = null where id = ?').run('candidate', listingId);

    expect(prices.promoteVerifiedCandidates()).toBe(1);
    expect(prices.getListing(listingId)).toMatchObject({ status: 'confirmed', confirmationSource: 'deterministic_match' });
    expect(prices.current(dollId)).toHaveLength(1);
  });

  it('keeps only the official Store listing current for one doll and region without deleting history', () => {
    const old = prices.ensureListing({ dollId, region: 'amazon_it', asin: 'B0OLD00001', url: 'https://www.amazon.it/dp/B0OLD00001', status: 'confirmed', confirmationSource: 'manual' });
    const official = prices.ensureListing({ dollId, region: 'amazon_it', asin: 'B0STORE001', url: 'https://www.amazon.it/dp/B0STORE001', status: 'confirmed', confirmationSource: 'deterministic_match' });
    const offer = (priceMinor: number) => ({ offerKind: 'regular' as const, priceMinor, currency: 'EUR' as const, shippingMinor: null as number | null, sellerName: 'Amazon', fulfilledByAmazon: true, availability: 'in_stock' as const, condition: 'New' as const, couponText: null as string | null, rateToKztMicros: 550_000_000 });
    prices.applyCheck({ listingId: old.id, status: 'verified', checkedAt: '2026-07-11T10:00:00.000Z', offer: offer(3050) });
    prices.applyCheck({ listingId: official.id, status: 'verified', checkedAt: '2026-07-11T11:00:00.000Z', offer: offer(2953) });

    prices.activateOfficialStoreListing(dollId, 'amazon_it', official.asin);

    expect(prices.current(dollId)).toEqual([expect.objectContaining({ asin: official.asin, region: 'amazon_it', priceMinor: 2953 })]);
    expect(prices.currentForDolls([dollId])[dollId]).toEqual([expect.objectContaining({ asin: official.asin })]);
    expect(prices.getListing(old.id)).toMatchObject({ status: 'frozen' });
    expect(prices.history(dollId, 'all')).toHaveLength(2);
  });
});
