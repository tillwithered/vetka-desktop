import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { CatalogRepository } from '@/main/catalog/repository';
import { CatalogRegionEvidenceRepository } from '@/main/catalog/region-evidence-repository';
import { CatalogRegionStateService } from '@/main/catalog/region-state-service';
import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { PriceRepository } from '@/main/prices/repository';

describe('CatalogRegionEvidenceRepository', () => {
  let db: DatabaseSync;
  let dollId: string;
  let repository: CatalogRegionEvidenceRepository;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    const dolls = new DollRepository(db);
    new CatalogRepository(db, dolls).importSeed([{
      mattelSku: 'JMB81', name: 'Робекка Стим — Core', characterName: 'Робекка Стим', lineName: 'Core',
      productType: 'regular', monitorStatus: 'active', requiredTerms: ['Robecca Steam'], rejectTerms: [],
      searchQuery: 'Monster High Robecca Steam JMB81', sourceUrl: 'https://shop.mattel.com/products/jmb81',
      sourceCheckedAt: '2026-07-12', evidence: 'Official Mattel', officialName: 'Monster High Robecca Steam Doll',
      mattelUrl: 'https://shop.mattel.com/products/jmb81', mattelImageUrl: 'https://cdn.shopify.com/jmb81.jpg',
    }]);
    dollId = dolls.findByMattelSku('JMB81')!.id;
    repository = new CatalogRegionEvidenceRepository(db);
  });

  it('upserts one auditable result per SKU and region', () => {
    repository.upsert({
      mattelSku: 'JMB81', dollId, region: 'amazon_it', status: 'no_price',
      evidenceUrl: 'https://www.amazon.it/dp/B0FJZYDKX9', asin: 'B0FJZYDKX9',
      checkedAt: '2026-07-12T10:00:00.000Z', diagnostic: { source: 'exact_product' },
    });
    repository.upsert({
      mattelSku: 'JMB81', dollId, region: 'amazon_it', status: 'verified',
      evidenceUrl: 'https://www.amazon.it/dp/B0FJZYDKX9', asin: 'B0FJZYDKX9',
      checkedAt: '2026-07-12T11:00:00.000Z', diagnostic: { source: 'exact_product' },
    });

    expect(repository.listForDoll(dollId)).toEqual([expect.objectContaining({
      mattelSku: 'JMB81', region: 'amazon_it', status: 'verified', asin: 'B0FJZYDKX9',
      checkedAt: '2026-07-12T11:00:00.000Z', diagnostic: { source: 'exact_product' },
    })]);
  });

  it('rejects evidence URLs from the wrong marketplace', () => {
    expect(() => repository.upsert({
      mattelSku: 'JMB81', dollId, region: 'amazon_it', status: 'not_found',
      evidenceUrl: 'https://www.amazon.com/s?k=JMB81', asin: null,
      checkedAt: '2026-07-12T10:00:00.000Z', diagnostic: {},
    })).toThrow('Evidence URL does not match Amazon region');
  });

  it('returns exactly five ordered regional states and only a currently verified price', () => {
    const prices = new PriceRepository(db);
    const listing = prices.ensureListing({
      dollId, region: 'amazon_us', asin: 'B0FJZYDKX9', url: 'https://www.amazon.com/dp/B0FJZYDKX9',
      status: 'confirmed', confirmationSource: 'exact_id',
    });
    prices.applyCheck({
      listingId: listing.id, status: 'verified', checkedAt: '2026-07-12T10:00:00.000Z',
      offer: { offerKind: 'regular', priceMinor: 2149, currency: 'USD', shippingMinor: null,
        sellerName: 'Amazon', fulfilledByAmazon: true, availability: 'in_stock', condition: 'New',
        couponText: null, rateToKztMicros: 500_000_000 },
    });
    repository.upsert({
      mattelSku: 'JMB81', dollId, region: 'amazon_us', status: 'verified',
      evidenceUrl: 'https://www.amazon.com/dp/B0FJZYDKX9', asin: 'B0FJZYDKX9',
      checkedAt: '2026-07-12T10:00:00.000Z', diagnostic: {},
    });
    repository.upsert({
      mattelSku: 'JMB81', dollId, region: 'amazon_it', status: 'no_price',
      evidenceUrl: 'https://www.amazon.it/dp/B0FJZYDKX9', asin: 'B0FJZYDKX9',
      checkedAt: '2026-07-12T11:00:00.000Z', diagnostic: {},
    });

    const states = new CatalogRegionStateService({ db, evidence: repository, prices, now: () => new Date('2026-07-13T20:00:00.000Z') }).list(dollId);

    expect(states.map((state) => state.region)).toEqual(['amazon_us', 'amazon_uk', 'amazon_de', 'amazon_es', 'amazon_it']);
    expect(states[0]).toMatchObject({ status: 'verified', currentPrice: { priceMinor: 2149 }, overdue: false });
    expect(states[1]).toMatchObject({ status: 'unchecked', checkedAt: null, currentPrice: null, evidenceUrl: 'https://www.amazon.co.uk/s?k=JMB81' });
    expect(states[4]).toMatchObject({ status: 'no_price', currentPrice: null, evidenceUrl: 'https://www.amazon.it/dp/B0FJZYDKX9', overdue: false });
  });

  it('marks a completed check overdue only after 36 hours', () => {
    repository.upsert({
      mattelSku: 'JMB81', dollId, region: 'amazon_it', status: 'no_price',
      evidenceUrl: 'https://www.amazon.it/dp/B0FJZYDKX9', asin: 'B0FJZYDKX9',
      checkedAt: '2026-07-12T10:00:00.000Z', diagnostic: {},
    });
    const service = new CatalogRegionStateService({ db, evidence: repository, prices: new PriceRepository(db), now: () => new Date('2026-07-13T22:00:00.001Z') });
    expect(service.list(dollId).find((state) => state.region === 'amazon_it')).toMatchObject({ overdue: true });
  });
});
