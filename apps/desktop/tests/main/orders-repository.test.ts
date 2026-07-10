import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { OrderRepository } from '@/main/orders/repository';
import { PriceRepository } from '@/main/prices/repository';

describe('OrderRepository', () => {
  let db: DatabaseSync;
  afterEach(() => db?.close());

  it('copies an immutable offer snapshot and appends status events', () => {
    db = new DatabaseSync(':memory:'); runMigrations(db);
    const doll = new DollRepository(db).create({ name: 'Draculaura' });
    const prices = new PriceRepository(db);
    const listing = prices.ensureListing({ dollId: doll.id, region: 'amazon_us', asin: 'B0CXYZ1234', url: 'https://www.amazon.com/dp/B0CXYZ1234', status: 'confirmed', confirmationSource: 'manual' });
    prices.applyCheck({ listingId: listing.id, status: 'verified', checkedAt: '2026-07-10T10:00:00Z', offer: { offerKind: 'regular', priceMinor: 2499, currency: 'USD', shippingMinor: 0, sellerName: 'Amazon.com', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New', couponText: null, rateToKztMicros: 514_200_000 } });
    const snapshotId = prices.current(doll.id)[0].snapshotId;
    const orders = new OrderRepository(db);
    const order = orders.create({ snapshotId, customerContact: '@violet_client', localShippingMinor: 0, localShippingRateToKztMicros: 514_200_000, weightGrams: 720, internationalRateMinorPerKg: 1200, internationalRateCurrency: 'USD', internationalRateToKztMicros: 514_200_000, extraCostsKztMinor: 80_000, customerPriceKztMinor: 2_490_000, notes: null });

    expect(order).toMatchObject({ customerContact: '@violet_client', sourceAsin: 'B0CXYZ1234', sourcePriceMinor: 2499, totalCostKztMinor: 1_809_255, status: 'new' });
    orders.transition(order.id, 'ordered', 'Оплачено');
    orders.updateTracking(order.id, 'TRACK123');
    expect(orders.get(order.id)).toMatchObject({ status: 'ordered', trackingNumber: 'TRACK123', totalCostKztMinor: 1_809_255 });
    expect(orders.get(order.id)?.events).toHaveLength(2);
  });
});
