import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CatalogRepository } from '@/main/catalog/repository';
import { monsterHighSkuCatalog } from '@/main/catalog/seed';
import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';
import { PriceRepository } from '@/main/prices/repository';
import { seedVerifiedAmazonListings, verifiedAmazonListings } from '@/main/catalog/listing-seed';
import { normalizeAmazonUrl } from '@/collector/amazon/url';

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
    officialName: 'Monster High Moonspell Magic Willow Thorne Doll',
    mattelUrl: 'https://shop.mattel.com/products/monster-high-moonspell-magic-willow-thorne-doll-jmb92-en-ca',
    mattelImageUrl: 'https://cdn.shopify.com/willow.jpg',
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
  it('ships a duplicate-free retail seed with the current Mattel releases', () => {
    expect(new Set(monsterHighSkuCatalog.map((entry) => entry.mattelSku)).size).toBe(monsterHighSkuCatalog.length);
    expect(monsterHighSkuCatalog.map((entry) => entry.mattelSku)).toEqual(expect.arrayContaining([
      'JMG63', 'JKD76', 'JMG74', 'JHK46', 'JMG66', 'JMG73', 'JMG65', 'JMB81',
    ]));
  });

  it('requires complete product-specific Mattel identity for active retail entries', () => {
    const active = monsterHighSkuCatalog.filter((entry) => entry.monitorStatus === 'active');
    for (const entry of active) {
      expect(entry.officialName, entry.mattelSku).toBeTruthy();
      expect(entry.mattelUrl, entry.mattelSku).toMatch(/^https:\/\/shop\.mattel\.com\/products\//);
      expect(entry.mattelImageUrl, entry.mattelSku).toMatch(/^https:\/\/cdn\.shopify\.com\//);
      expect(entry.sourceUrl, entry.mattelSku).toBe(entry.mattelUrl);
    }
  });

  it('rejects an active entry without complete official Mattel identity', () => {
    expect(() => catalog.importSeed([{ ...seed[0], officialName: null }])).toThrow(
      'Active catalog entry requires official Mattel identity',
    );
  });

  it('uses a Russian operational name and verified Mattel identity for Robecca', () => {
    expect(monsterHighSkuCatalog.find((entry) => entry.mattelSku === 'JHK59')).toMatchObject({
      name: 'Робекка Стим — Boo-riginal Creeproduction',
      officialName: 'Monster High Boo-Riginal Creeproduction Robecca Steam Doll With Diary, Doll Stand And Pet',
      mattelUrl: 'https://shop.mattel.com/products/monster-high-boo-riginal-creeproduction-robecca-steam-doll-jhk59',
      mattelImageUrl: expect.stringContaining('cdn.shopify.com'),
    });
  });

  it('normalizes imported core dolls to Russian operational names with verified Mattel identity', () => {
    expect(monsterHighSkuCatalog.find((entry) => entry.mattelSku === 'JHK31')).toMatchObject({
      name: 'Фрэнки Штейн — Core',
      officialName: 'Monster High Frankie Stein Fashion Doll in Black Pleather Skirt With Pet Watzie And 7 Accessories',
      mattelUrl: 'https://shop.mattel.com/products/monster-high-frankie-stein-doll-jhk31',
      mattelImageUrl: expect.stringContaining('cdn.shopify.com'),
    });
  });

  it('imports a seed idempotently and creates one doll per SKU', () => {
    expect(catalog.importSeed(seed)).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(catalog.importSeed(seed)).toEqual({ inserted: 0, updated: 1, skipped: 0 });
    expect(dolls.list({ query: 'JMB92' })).toHaveLength(1);
    expect(catalog.listActive()).toEqual([
      expect.objectContaining({ mattelSku: 'JMB92', dollId: expect.any(String), monitorStatus: 'active' }),
    ]);
  });

  it('applies Mattel identity and image to a seed doll but preserves a manual image', () => {
    catalog.importSeed([{ ...seed[0], name: 'Виллоу Торн — Moonspell Magic' }]);
    const willow = dolls.findByMattelSku('JMB92')!;
    expect(willow).toMatchObject({
      name: 'Виллоу Торн — Moonspell Magic',
      officialName: seed[0].officialName,
      mattelUrl: seed[0].mattelUrl,
      imagePath: seed[0].mattelImageUrl,
      imageSource: 'mattel',
    });

    dolls.update(willow.id, { imagePath: 'C:/manual/willow.jpg' });
    catalog.importSeed([{ ...seed[0], mattelImageUrl: 'https://cdn.shopify.com/replacement.jpg' }]);

    expect(dolls.get(willow.id)).toMatchObject({ imagePath: 'C:/manual/willow.jpg', imageSource: 'manual' });
  });

  it('does not clear manual official identity when a registry entry has no verified Mattel page', () => {
    const manual = dolls.create({
      name: 'Ручная Салли', mattelSku: 'HNF99',
      officialName: 'Manual Nightmare Before Christmas title',
      mattelUrl: 'https://shop.mattel.com/products/manual-nightmare',
    });
    const unsupported = monsterHighSkuCatalog.find((entry) => entry.mattelSku === 'HNF99')!;

    catalog.importSeed([unsupported]);

    expect(dolls.get(manual.id)).toMatchObject({
      officialName: 'Manual Nightmare Before Christmas title',
      mattelUrl: 'https://shop.mattel.com/products/manual-nightmare',
    });
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

  it('keeps trusted Amazon mappings unique and canonical by SKU and region', () => {
    const keys = new Set<string>();
    for (const listing of verifiedAmazonListings) {
      const key = `${listing.mattelSku}:${listing.region}`;
      expect(keys.has(key), key).toBe(false);
      keys.add(key);
      expect(normalizeAmazonUrl(listing.url)).toMatchObject({ region: listing.region, asin: listing.asin });
      expect(listing.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
