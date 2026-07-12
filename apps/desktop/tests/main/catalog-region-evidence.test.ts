import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { CatalogRepository } from '@/main/catalog/repository';
import { CatalogRegionEvidenceRepository } from '@/main/catalog/region-evidence-repository';
import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';

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
});
