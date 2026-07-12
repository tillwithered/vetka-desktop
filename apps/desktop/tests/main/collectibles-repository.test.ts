import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CollectiblesRepository, type CollectibleUpsert } from '@/main/collectibles/repository';
import { runMigrations } from '@/main/db/migrate';

const url = 'https://creations.mattel.com/products/monster-high-skullector-ghostbusters-gozer-doll-jkm54';
const record: CollectibleUpsert = {
  mattelSku: null,
  canonicalUrl: url,
  nameRu: 'Гозер — Skullector',
  officialName: 'Monster High Skullector Ghostbusters Gozer Doll',
  lineName: 'Skullector x Ghostbusters',
  priceMinor: 7000,
  currency: 'USD',
  lifecycle: 'in_stock' as const,
  saleStartsAt: null,
  fangClubOnly: false,
  imageUrl: 'https://cdn.shopify.com/gozer.jpg',
  checkedAt: '2026-07-12T00:00:00.000Z',
};

let db: DatabaseSync;
let repository: CollectiblesRepository;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  runMigrations(db);
  repository = new CollectiblesRepository(db);
});

afterEach(() => db.close());

describe('CollectiblesRepository', () => {
  it('upserts by canonical URL then upgrades identity to SKU without duplication', () => {
    repository.upsert(record);
    repository.upsert({ ...record, mattelSku: 'JKM54', lifecycle: 'preorder' });

    expect(repository.list({ archived: false })).toHaveLength(1);
    expect(repository.list({ archived: false })[0]).toMatchObject({ mattelSku: 'JKM54', lifecycle: 'preorder' });
  });

  it('archives only after two consecutive complete scans omit a product and restores it on upsert', () => {
    repository.upsert(record);
    repository.finishCompleteScan([]);
    expect(repository.list({ archived: false })).toHaveLength(1);
    repository.finishCompleteScan([]);
    expect(repository.list({ archived: true })).toHaveLength(1);

    repository.upsert({ ...record, lifecycle: 'in_stock' });
    expect(repository.list({ archived: false })).toHaveLength(1);
  });

  it('records a failed check without erasing last-known product facts', () => {
    const saved = repository.upsert(record);
    repository.recordFailure(url, '2026-07-13T00:00:00.000Z');

    expect(repository.list({ archived: false })[0]).toMatchObject({
      id: saved.id,
      priceMinor: 7000,
      lifecycle: 'in_stock',
      lastCheckResult: 'error',
      lastCheckedAt: '2026-07-13T00:00:00.000Z',
    });
  });

  it('filters by archive and searches Russian, English, line, and SKU identity', () => {
    repository.upsert({ ...record, mattelSku: 'JKM54' });
    expect(repository.list({ archived: false, query: 'Гозер' })).toHaveLength(1);
    expect(repository.list({ archived: false, query: 'Ghostbusters' })).toHaveLength(1);
    expect(repository.list({ archived: false, query: 'JKM54' })).toHaveLength(1);
  });
});
