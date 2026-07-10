import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from '@/main/db/migrate';
import { DollRepository } from '@/main/dolls/repository';

let db: DatabaseSync;
let dolls: DollRepository;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  runMigrations(db);
  dolls = new DollRepository(db);
});

afterEach(() => db.close());

describe('DollRepository', () => {
  it('creates, retrieves, updates, searches, and favorites dolls', () => {
    const draculaura = dolls.create({
      name: 'Draculaura Core Refresh',
      characterName: 'Draculaura',
      lineName: 'Core Refresh',
      generation: 'G3',
      mattelSku: 'HRP64',
      upcEan: '194735183302',
      imagePath: null,
      notes: null,
    });
    dolls.create({ name: 'Venus McFlytrap' });

    expect(dolls.get(draculaura.id)).toMatchObject({
      name: 'Draculaura Core Refresh',
      isFavorite: false,
    });
    expect(dolls.list({ query: 'draculaura' })).toHaveLength(1);
    expect(dolls.list({ query: 'HRP64' })).toHaveLength(1);

    dolls.setFavorite(draculaura.id, true);
    expect(dolls.list({ favoritesOnly: true })).toEqual([
      expect.objectContaining({ id: draculaura.id, isFavorite: true }),
    ]);

    const updated = dolls.update(draculaura.id, { notes: 'Заказать две' });
    expect(updated.notes).toBe('Заказать две');
    expect(updated.updatedAt >= draculaura.updatedAt).toBe(true);
  });

  it('returns null for a missing ID', () => {
    expect(dolls.get('missing')).toBeNull();
  });

  it('rejects invalid names and UPC/EAN values', () => {
    expect(() => dolls.create({ name: '   ' })).toThrow();
    expect(() => dolls.create({ name: 'Clawdeen', upcEan: '12AB' })).toThrow();
  });
});
