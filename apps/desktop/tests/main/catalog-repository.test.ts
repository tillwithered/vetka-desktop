import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CatalogRepository } from '@/main/catalog/repository';
import { monsterHighSkuCatalog } from '@/main/catalog/seed';
import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { PriceRepository } from '@/main/prices/repository';
import { seedVerifiedAmazonListings } from '@/main/catalog/listing-seed';

const seed = [
  {
    mattelSku: 'JMB92',
    name: 'Willow Thorne',
    characterName: 'Willow Thorne',
    lineName: 'Moonspell Magic',
    productType: 'regular',
    monitorStatus: 'active' as const,
    requiredTerms: ['Willow Thorne', 'Moonspell Magic'],
    rejectTerms: ['used', 'outfit'],
    searchQuery: 'Monster High JMB92',
    sourceUrl: 'https://shop.mattel.com/products/monster-high-moonspell-magic-willow-thorne-doll-jmb92-en-ca',
    sourceCheckedAt: '2026-07-10',
    evidence: 'Mattel official product URL',
  },
] as const;

let db: DatabaseSync;
let catalog: CatalogRepository;
let dolls: DollRepository;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  runMigrations(db);
  dolls = new DollRepository(db);
  catalog = new CatalogRepository(db, dolls);
});

afterEach(() => db.close());

describe('CatalogRepository', () => {
  it('ships a 21-item Monster High SKU seed without duplicate SKUs', () => {
    expect(monsterHighSkuCatalog).toHaveLength(21);
    expect(new Set(monsterHighSkuCatalog.map((entry) => entry.mattelSku)).size).toBe(21);
  });

  it('imports a seed idempotently and creates one doll per SKU', () => {
    expect(catalog.importSeed(seed)).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(catalog.importSeed(seed)).toEqual({ inserted: 0, updated: 1, skipped: 0 });
    expect(dolls.list({ query: 'JMB92' })).toHaveLength(1);
    expect(catalog.listActive()).toEqual([
      expect.objectContaining({ mattelSku: 'JMB92', dollId: expect.any(String), monitorStatus: 'active' }),
    ]);
  });

  it('validates a whole import before writing any row', () => {
    expect(() => catalog.importSeed([{ ...seed[0], mattelSku: '' }])).toThrow('Invalid catalog entry');
    expect(catalog.listActive()).toEqual([]);
  });

  it('seeds a live-verified Amazon listing as a confirmed direct check', () => {
    catalog.importSeed(monsterHighSkuCatalog);
    const prices = new PriceRepository(db);

    seedVerifiedAmazonListings({ catalog, prices });

    const catty = catalog.listAll().find((entry) => entry.mattelSku === 'HXH76');
    expect(catty?.dollId).toBeTruthy();
    expect(prices.listListings(catty!.dollId!)).toContainEqual(expect.objectContaining({
      region: 'amazon_es', asin: 'B0CMGDLQC9', status: 'confirmed', confirmationSource: 'exact_id',
    }));
    expect(catalog.listActive().at(0)).toMatchObject({ mattelSku: 'HXH76' });
  });
});
