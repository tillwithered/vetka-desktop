import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { runMigrations } from '@/main/db/migrate';

describe('V0 migration', () => {
  it('creates every V0 table and enables foreign keys', () => {
    const db = new DatabaseSync(':memory:');

    runMigrations(db);

    const names = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => String(row.name));

    expect(names).toEqual(
      expect.arrayContaining([
        'amazon_listings',
        'collectibles',
        'collectibles_scan_state',
        'dolls',
        'order_status_events',
        'orders',
        'price_checks',
        'price_snapshots',
        'schema_migrations',
        'settings',
      ]),
    );
    expect(db.prepare('pragma foreign_keys').get()).toEqual({ foreign_keys: 1 });
    expect(db.prepare('select max(version) as version from schema_migrations').get()).toEqual({ version: 6 });
    expect(db.prepare("pragma table_info('dolls')").all()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'official_name' }),
      expect.objectContaining({ name: 'mattel_url' }),
      expect.objectContaining({ name: 'image_source' }),
    ]));

    db.close();
  });
});
